const express = require("express");
const router = express.Router();
const Pc = require("../models/Pc");
const Pic = require("../models/PicTemp");
const Location = require("../models/Location");
const Spec = require("../models/Spec");
const Performance = require("../models/Performance");
const SpecHistory = require("../models/SpecHistory");
const PcHistory = require("../models/PcHistory");
const verifyToken = require("../middleware/verifyToken");
const Uptime = require("../models/Uptime");
const UpdateLog = require("../models/UpdateLog");
const AgentUpdateLog = require("../models/AgentUpdateLog");
const mongoose = require("mongoose");
const { resolvePic } = require("../utils/picResolver");

// helpers
const toObjectId = (v) =>
  mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : null;

const isEmail = (s = "") => /\S+@\S+\.\S+/.test(String(s));
const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// 🔧 Normalisasi PIC → simpan detail penting
function normalizePic(pic) {
  if (!pic) return null;
  if (typeof pic !== "object") return { name: pic };

  return {
    name: pic.name || "-",
    email: pic.email || "-",
    department: pic.department || "-",
    phone: pic.phone || "-",
  };
}

/* ===========================
   GET: history log PC
   (HARUS sebelum `/:id`)
=========================== */
router.get("/history", verifyToken, async (req, res) => {
  try {
    const logs = await PcHistory.find().sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    console.error("❌ Error get pc/history:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});


/* ===========================
   UPDATE PC
=========================== */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const validCategories = await Location.distinct("category");

    if (
      req.body.category !== undefined &&
      !validCategories.includes(req.body.category)
    ) {
      return res
        .status(400)
        .json({ message: `Kategori tidak valid: ${req.body.category}` });
    }

    // field yang boleh diubah
    const allowed = [
      "assetNumber",
      "pic",
      "location",
      "userLogin",
      "isAdmin",
      "lifecycleStatus",
    ];

    const updateFields = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updateFields[key] = req.body[key];
    }

    // --- Ambil snapshot lama SEBELUM resolvePic ---
    const beforeUpdate = await Pc.findById(req.params.id)
      .populate("location")
      .populate("pic", "name email department phone")
      .lean();
    if (!beforeUpdate)
      return res.status(404).json({ message: "PC not found" });

    const oldSnapshot = { ...beforeUpdate };
    if (oldSnapshot.location?.campus && oldSnapshot.location?.room) {
      oldSnapshot.location = `${oldSnapshot.location.campus} - ${oldSnapshot.location.room}`;
    }
    oldSnapshot.pic = normalizePic(beforeUpdate.pic);

    // ======== Resolve PIC + update PC ========
    if (updateFields.pic !== undefined) {
      const picId = await resolvePic(updateFields.pic);
      updateFields.pic = picId;
    }

    await Pc.updateOne(
      { _id: req.params.id },
      { $set: updateFields },
      { runValidators: true }
    );

    // --- Ambil snapshot baru ---
    const updated = await Pc.findById(req.params.id)
      .populate("location")
      .populate("pic", "name email department phone");

    const newSnapshot = updated.toObject();
    if (newSnapshot.location?.campus && newSnapshot.location?.room) {
      newSnapshot.location = `${newSnapshot.location.campus} - ${newSnapshot.location.room}`;
    }
    newSnapshot.pic = normalizePic(updated.pic);

    // --- Simpan history ---
    await PcHistory.create({
      pcId: oldSnapshot.pcId || oldSnapshot.serialNumber,
      oldData: oldSnapshot,
      newData: newSnapshot,
      action: "edit",
      adminName: req.user?.username || "unknown",
      timestamp: new Date(),
    });

    res.json({ message: "✅ PC updated", pc: updated });
  } catch (err) {
    console.error("❌ Gagal update PC:", err.message);
    if (err.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "❌ Validasi gagal", error: err.message });
    }
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   PATCH: mass update timeout
=========================== */
router.patch("/timeout", verifyToken, async (req, res) => {
  try {
    const { pcIds, idleTimeout } = req.body;

    if (!Array.isArray(pcIds) || typeof idleTimeout !== "number") {
      return res
        .status(400)
        .json({ message: "Format data tidak valid (pcIds/idleTimeout)" });
    }
    console.log("📩 Body:", req.body);

    const updated = await Pc.updateMany(
      { pcId: { $in: pcIds } },
      { $set: { idleTimeout } }
    );

    // 🔔 Emit ke agent agar config langsung terupdate
    try {
      const { getSocketIo } = require("../socketRegistry");
      const io = getSocketIo();
      const affectedPcs = await Pc.find({ pcId: { $in: pcIds } });
      affectedPcs.forEach((pc) => {
        io.to(pc._id.toString()).emit("agent-config-updated");
        io.to(pc.pcId).emit("agent-config-updated");
      });
      console.log(`🔔 agent-config-updated emitted to ${affectedPcs.length} PCs`);
    } catch (emitErr) {
      console.warn("⚠️ Emit gagal tapi tidak fatal:", emitErr.message);
    }

    res.json({
      message: `✅ idleTimeout diupdate untuk ${
        updated.modifiedCount || updated.nModified
      } PC`,
    });
  } catch (err) {
    console.error("❌ Error mass update idleTimeout:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   PATCH: mass update performance interval
=========================== */
router.patch("/performance-interval", verifyToken, async (req, res) => {
  try {
    const { pcIds, performanceInterval } = req.body;

    // 🧩 Validasi input dasar
    if (!Array.isArray(pcIds) || typeof performanceInterval !== "number") {
      return res
        .status(400)
        .json({ message: "Format data tidak valid (pcIds/performanceInterval)" });
    }

    // ⚙️ Batas aman interval (10 detik – 1 jam)
    if (performanceInterval < 10 || performanceInterval > 3600) {
      return res.status(400).json({
        message: "Interval harus antara 10–3600 detik (10 dtk – 1 jam)",
      });
    }

    console.log("📩 Update performanceInterval:", { pcIds, performanceInterval });

    // 💾 Update ke database
    const updated = await Pc.updateMany(
      { pcId: { $in: pcIds } },
      { $set: { performanceInterval } }
    );

    // 🔔 Emit ke agent (tanpa blocking res)
    try {
      const { getSocketIo } = require("../socketRegistry");
      const io = getSocketIo();
      const affectedPcs = await Pc.find({ pcId: { $in: pcIds } });
      affectedPcs.forEach((pc) => {
        // Emit to both rooms: ObjectId (used by agent) and pcId string (used by dashboard)
        io.to(pc._id.toString()).emit("agent-config-updated");
        io.to(pc.pcId).emit("agent-config-updated");
      });
    } catch (emitErr) {
      console.warn("⚠️ Emit gagal tapi tidak fatal:", emitErr.message);
    }

    // ✅ Pastikan respon sukses 200 dikirim
    return res.status(200).json({
      success: true,
      message: `✅ performanceInterval diupdate untuk ${
        updated.modifiedCount || updated.nModified || 0
      } PC`,
    });
  } catch (err) {
    console.error("❌ Error mass update performanceInterval:", err.message);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/* ===========================
   DELETE PC
=========================== */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const pcId = req.params.id;

    const pc = await Pc.findById(pcId).populate("location pic");
    if (!pc) {
      return res.status(404).json({ message: "PC not found" });
    }

    const snapshot = pc.toObject();
    if (snapshot.location?.campus && snapshot.location?.room) {
      snapshot.location = `${snapshot.location.campus} - ${snapshot.location.room}`;
    }

    // 🔧 Normalisasi PIC di delete log juga
    snapshot.pic = normalizePic(snapshot.pic);

    await PcHistory.create({
      pcId: snapshot.pcId || snapshot.serialNumber,
      oldData: snapshot,
      action: "delete",
      adminName: req.user?.username || "unknown",
      timestamp: new Date(),
    });

    await Promise.all([
      Spec.deleteOne({ pc: pcId }),
      SpecHistory.deleteMany({ pc: pcId }),
      Performance.deleteMany({ pc: pcId }),
      Uptime.deleteMany({ pc: pcId }),
      UpdateLog.deleteMany({ pc: pcId }),
      AgentUpdateLog.deleteMany({ pc: pcId }),
      Pc.findByIdAndDelete(pcId),
    ]);

    res.json({ message: "🗑️ PC dan semua data terkait berhasil dihapus" });
  } catch (err) {
    console.error("❌ Gagal hapus PC:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   GET PC by ID (paling akhir)
=========================== */

router.get("/:id([0-9a-fA-F]{24})", verifyToken, async (req, res) => {
  try {
    const pc = await Pc.findById(req.params.id).populate("location pic");
    if (!pc) return res.status(404).json({ message: "PC not found" });
    res.json(pc);
  } catch (err) {
    console.error("❌ Error get PC by id:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
