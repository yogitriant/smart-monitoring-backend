const express = require("express");
const router = express.Router();
const Asset = require("../models/Asset");
const Pc = require("../models/Pc");
const Spec = require("../models/Spec");
const Performance = require("../models/Performance");
const SpecHistory = require("../models/SpecHistory");
const PcHistory = require("../models/PcHistory");
const Uptime = require("../models/Uptime");
const UpdateLog = require("../models/UpdateLog");
const AgentUpdateLog = require("../models/AgentUpdateLog");
const { resolvePic } = require("../utils/picResolver");
const verifyToken = require("../middleware/verifyToken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../public/attachments");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Only PDF, JPG, and PNG files are allowed"), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter
});

// ─── GET /api/assets/stats ── Summary counts ───────────
router.get("/stats", verifyToken, async (req, res) => {
    try {
        const matchStage = {};
        if (req.user && req.user.role === "user") {
            matchStage.site = req.user.site;
        }

        const statsMatch = Object.keys(matchStage).length > 0 ? { $match: matchStage } : { $match: {} };

        const [byStatus, byCategory, bySite, total] = await Promise.all([
            Asset.aggregate([statsMatch, { $group: { _id: "$status", count: { $sum: 1 } } }]),
            Asset.aggregate([statsMatch, { $group: { _id: "$productCategory", count: { $sum: 1 } } }]),
            Asset.aggregate([statsMatch, { $group: { _id: "$site", count: { $sum: 1 } } }]),
            Asset.countDocuments(matchStage),
        ]);

        res.json({ total, byStatus, byCategory, bySite });
    } catch (err) {
        console.error("❌ Gagal ambil stats asset:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ─── GET /api/assets ── List semua asset ───────────────
router.get("/", verifyToken, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 25,
            search,
            status,
            productCategory,
            subCategory,
            site,
            region,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = req.query;

        const filter = {};

        // Security check: If role is "user", force the site filter
        if (req.user && req.user.role === "user") {
            filter.site = req.user.site;
        } else if (site) {
            filter.site = site;
        }

        if (status) filter.status = status;
        if (productCategory) filter.productCategory = productCategory;
        if (subCategory) filter.subCategory = subCategory;
        if (region) filter.region = region;

        if (search) {
            const regex = new RegExp(search, "i");
            filter.$or = [
                { faNumber: regex },
                { serialNumber: regex },
                { productName: regex },
                { manufacturer: regex },
                { ownerFullname: regex },
                { brand: regex },
                { model: regex },
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

        const [assets, total] = await Promise.all([
            Asset.find(filter)
                .populate("pc", "pcId status lastActive ipAddress")
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit)),
            Asset.countDocuments(filter),
        ]);

        res.json({
            assets,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
        });
    } catch (err) {
        console.error("❌ Gagal ambil list asset:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ─── GET /api/assets/filters ── Distinct values for filters ──
router.get("/filters", async (req, res) => {
    try {
        const [statuses, categories, subCategories, sites, regions, manufacturers] =
            await Promise.all([
                Asset.distinct("status"),
                Asset.distinct("productCategory"),
                Asset.distinct("subCategory"),
                Asset.distinct("site"),
                Asset.distinct("region"),
                Asset.distinct("manufacturer"),
            ]);

        res.json({ statuses, categories, subCategories, sites, regions, manufacturers });
    } catch (err) {
        console.error("❌ Gagal ambil filters:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ─── GET /api/assets/:id ── Detail satu asset ─────────
router.get("/:id", verifyToken, async (req, res) => {
    try {
        const asset = await Asset.findById(req.params.id)
            .populate("pc", "pcId status lastActive ipAddress performance spec userLogin")
            .populate("location");

        if (!asset) {
            return res.status(404).json({ message: "Asset tidak ditemukan" });
        }

        // Access check
        if (req.user && req.user.role === "user" && asset.site !== req.user.site) {
             return res.status(403).json({ message: "Forbidden: You don't have access to this asset's site." });
        }

        res.json(asset);
    } catch (err) {
        console.error("❌ Gagal ambil detail asset:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ─── POST /api/assets ── Buat asset baru ───────────────
router.post("/", verifyToken, async (req, res) => {
    try {
        // Access check
        if (req.user && req.user.role === "user") {
             if (req.body.site && req.body.site !== req.user.site) {
                 return res.status(403).json({ message: "Forbidden: You can only create assets in your own site." });
             }
             // Force site
             req.body.site = req.user.site;
        }

        const asset = await Asset.create(req.body);

        // 🔄 Sync ke PC yang terhubung (jika ada) saat create
        if (asset.pc) {
            try {
                const pcUpdate = {};
                if (req.body.ownerFullname) {
                    const picId = await resolvePic(req.body.ownerFullname);
                    if (picId) pcUpdate.pic = picId;
                }
                if (req.body.faNumber !== undefined) pcUpdate.assetNumber = req.body.faNumber || "-";
                if (req.body.location !== undefined) pcUpdate.location = req.body.location || null;
                if (req.body.site !== undefined) pcUpdate.site = req.body.site || "";
                
                if (Object.keys(pcUpdate).length > 0) {
                    await Pc.findByIdAndUpdate(asset.pc, { $set: pcUpdate });
                }
            } catch (syncErr) {
                console.warn("⚠️ Sync Asset→PC failed at creation:", syncErr.message);
            }
        }

        res.status(201).json(asset);
    } catch (err) {
        console.error("❌ Gagal buat asset:", err.message);
        if (err.code === 11000) {
            return res.status(400).json({ message: "FA Number sudah digunakan" });
        }
        res.status(500).json({ message: "Server error" });
    }
});

// ─── PUT /api/assets/:id ── Update asset ───────────────
router.put("/:id", verifyToken, async (req, res) => {
    try {
        const existingAsset = await Asset.findById(req.params.id);
        if (!existingAsset) return res.status(404).json({ message: "Asset tidak ditemukan" });

        // Access check
        if (req.user && req.user.role === "user" && existingAsset.site !== req.user.site) {
             return res.status(403).json({ message: "Forbidden: You don't have access to edit this asset." });
        }
        if (req.user && req.user.role === "user" && req.body.site && req.body.site !== req.user.site) {
             return res.status(403).json({ message: "Forbidden: You cannot move assets to another site." });
        }

        const asset = await Asset.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        if (!asset) {
            return res.status(404).json({ message: "Asset tidak ditemukan" });
        }

        // Catat Log Edit Asset ke PcHistory
        try {
            let logPcId = asset.serialNumber || "-";
            if (asset.pc) {
                const linkedPc = await Pc.findById(asset.pc).lean();
                if (linkedPc) logPcId = linkedPc.pcId || linkedPc.serialNumber;
            }
            await PcHistory.create({
                pcId: logPcId,
                oldData: existingAsset.toObject(),
                newData: asset.toObject(),
                action: "edit",
                adminName: req.user?.username || "system (asset edit)",
                timestamp: new Date(),
            });
        } catch (logErr) {
            console.error("⚠️ Gagal mencatat log tipe Asset Edit:", logErr.message);
        }

        // 🔄 Sync ke PC yang terhubung (non-blocking)
        if (asset.pc) {
            try {
                const pcUpdate = {};

                // Sync owner → PIC
                if (req.body.ownerFullname) {
                    const picId = await resolvePic(req.body.ownerFullname);
                    if (picId) pcUpdate.pic = picId;
                }

                // Sync FA Number → assetNumber
                if (req.body.faNumber !== undefined) {
                    pcUpdate.assetNumber = req.body.faNumber || "-";
                }

                // Sync location → PC location
                if (req.body.location !== undefined) {
                    pcUpdate.location = req.body.location || null;
                }

                // Sync site → PC site
                if (req.body.site !== undefined) {
                    pcUpdate.site = req.body.site || "";
                }

                if (Object.keys(pcUpdate).length > 0) {
                    await Pc.findByIdAndUpdate(asset.pc, { $set: pcUpdate });
                    console.log("🔄 PC synced from Asset update:", Object.keys(pcUpdate).join(", "));
                }
            } catch (syncErr) {
                console.warn("⚠️ Sync Asset→PC failed:", syncErr.message);
            }
        }

        res.json(asset);
    } catch (err) {
        console.error("❌ Gagal update asset:", err.message);
        if (err.code === 11000) {
            return res.status(400).json({ message: "FA Number sudah digunakan" });
        }
        res.status(500).json({ message: "Server error" });
    }
});

// ─── DELETE /api/assets/:id ── Hapus asset ─────────────
router.delete("/:id", verifyToken, async (req, res) => {
    try {
        const asset = await Asset.findById(req.params.id);
        if (!asset) {
            return res.status(404).json({ message: "Asset tidak ditemukan" });
        }

        // Access check
        if (req.user && req.user.role === "user" && asset.site !== req.user.site) {
             return res.status(403).json({ message: "Forbidden: You don't have access to delete this asset." });
        }

        const pcId = asset.pc;

        // Binasakan asset tersebut
        await Asset.findByIdAndDelete(req.params.id);

        // Jika terikat dengan PC, lakukan cascade delete pada PC dan semua metrik agen
        if (pcId) {
            console.log(`🗑️ Asset memiliki PC terhubung (ID: ${pcId}), menghapus secara kaskade...`);
            
            // Catat log delete untuk PC jika perlu (opsional, tapi disarankan)
            const pcToDelete = await Pc.findById(pcId).lean();
            if (pcToDelete) {
                await PcHistory.create({
                    pcId: pcToDelete.pcId || pcToDelete.serialNumber,
                    oldData: pcToDelete,
                    action: "delete",
                    adminName: req.user?.username || "system (asset deletion)",
                    timestamp: new Date(),
                });
            }

            await Promise.all([
                Spec.deleteOne({ pc: pcId }),
                SpecHistory.deleteMany({ pc: pcId }),
                Performance.deleteMany({ pc: pcId }),
                Uptime.deleteMany({ pc: pcId }),
                UpdateLog.deleteMany({ pc: pcId }),
                AgentUpdateLog.deleteMany({ pc: pcId }),
                Pc.findByIdAndDelete(pcId),
            ]);
        }

        res.json({ message: "Asset berhasil dihapus beserta PC/data terkait (jika ada)" });
    } catch (err) {
        console.error("❌ Gagal hapus asset:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});
// ─── POST /api/assets/:id/attachments ── Upload attachments ──
router.post("/:id/attachments", verifyToken, upload.array("files", 10), async (req, res) => {
    try {
        const asset = await Asset.findById(req.params.id);
        if (!asset) return res.status(404).json({ message: "Asset tidak ditemukan" });

        if (req.user && req.user.role === "user" && asset.site !== req.user.site) {
            return res.status(403).json({ message: "Forbidden: You don't have access to edit this asset." });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No files uploaded" });
        }

        const newAttachments = req.files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            url: `/attachments/${file.filename}`,
            mimetype: file.mimetype,
            size: file.size
        }));

        asset.attachments.push(...newAttachments);
        await asset.save();

        res.status(201).json(asset.attachments);
    } catch (err) {
        console.error("❌ Gagal upload attachment:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ─── DELETE /api/assets/:id/attachments/:attachmentId ── Hapus attachment ──
router.delete("/:id/attachments/:attachmentId", verifyToken, async (req, res) => {
    try {
        const asset = await Asset.findById(req.params.id);
        if (!asset) return res.status(404).json({ message: "Asset tidak ditemukan" });

        if (req.user && req.user.role === "user" && asset.site !== req.user.site) {
            return res.status(403).json({ message: "Forbidden: You don't have access to edit this asset." });
        }

        const attachment = asset.attachments.id(req.params.attachmentId);
        if (!attachment) {
            return res.status(404).json({ message: "Attachment tidak ditemukan" });
        }

        // Delete file from disk
        const filePath = path.join(__dirname, "../public/attachments", attachment.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        attachment.deleteOne();
        await asset.save();

        res.json({ message: "Attachment berhasil dihapus", attachments: asset.attachments });
    } catch (err) {
        console.error("❌ Gagal hapus attachment:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
