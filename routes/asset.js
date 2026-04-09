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

module.exports = router;
