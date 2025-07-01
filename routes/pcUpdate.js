const express = require("express");
const router = express.Router();
const Pc = require("../models/Pc");
const Location = require("../models/Location");
const Spec = require("../models/Spec");
const Performance = require("../models/Performance");
const SpecHistory = require("../models/SpecHistory");
const PcHistory = require("../models/PcHistory");
const verifyToken = require("../middleware/verifyToken");

// GET history logs
router.get("/history", verifyToken, async (req, res) => {
  try {
    const logs = await PcHistory.find().sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// UPDATE PC
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

    const allowed = [
      "email",
      "assetNumber",
      "pic",
      "location",
      "userLogin",
      "isAdmin",
      "lifecycleStatus",
    ];
    const updateFields = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updateFields[key] = req.body[key];
      }
    }

    // Ambil data sebelum update, termasuk lokasi
    const beforeUpdate = await Pc.findById(req.params.id).populate("location");
    if (!beforeUpdate) {
      return res.status(404).json({ message: "PC not found" });
    }

    const oldSnapshot = beforeUpdate.toObject();
    if (oldSnapshot.location?.campus && oldSnapshot.location?.room) {
      oldSnapshot.location = `${oldSnapshot.location.campus} - ${oldSnapshot.location.room}`;
    }

    // Update PC
    const updated = await Pc.findByIdAndUpdate(req.params.id, updateFields, {
      new: true,
    }).populate("location");

    if (!updated) {
      console.log("❌ Updated PC is null");
      return res.status(500).json({ message: "Gagal update PC" });
    }

    const newSnapshot = updated.toObject();
    if (newSnapshot.location?.campus && newSnapshot.location?.room) {
      newSnapshot.location = `${newSnapshot.location.campus} - ${newSnapshot.location.room}`;
    }

    // Simpan log edit
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
    res.status(500).json({ message: "Server error" });
  }
});
// PATCH /api/pc/timeout
router.patch("/timeout", verifyToken, async (req, res) => {
  try {
    const { pcIds, idleTimeout } = req.body;

    if (!Array.isArray(pcIds) || typeof idleTimeout !== "number") {
      return res
        .status(400)
        .json({ message: "Format data tidak valid (pcIds/idleTimeout)" });
    }

    const updated = await Pc.updateMany(
      { pcId: { $in: pcIds } },
      { $set: { idleTimeout } }
    );

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

// DELETE PC
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const pcId = req.params.id;

    const pc = await Pc.findById(pcId).populate("location");
    if (!pc) {
      return res.status(404).json({ message: "PC not found" });
    }

    const snapshot = pc.toObject();
    if (snapshot.location?.campus && snapshot.location?.room) {
      snapshot.location = `${snapshot.location.campus} - ${snapshot.location.room}`;
    }

    await PcHistory.create({
      pcId: snapshot.pcId || snapshot.serialNumber,
      oldData: snapshot,
      action: "delete",
      adminName: req.user?.username || "unknown",
      timestamp: new Date(),
    });

    await Promise.all([
      Spec.deleteOne({ pc: pcId }),
      Performance.deleteMany({ pc: pcId }),
      SpecHistory.deleteMany({ pc: pcId }),
      Pc.findByIdAndDelete(pcId),
    ]);

    res.json({ message: "🗑️ PC dan semua data terkait berhasil dihapus" });
  } catch (err) {
    console.error("❌ Gagal hapus PC:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
