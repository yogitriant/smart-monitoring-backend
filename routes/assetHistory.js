const express = require("express");
const router = express.Router();
const Asset = require("../models/Asset");
const PcHistory = require("../models/PcHistory");
const SpecHistory = require("../models/SpecHistory");
const verifyToken = require("../middleware/verifyToken");

/* ===========================
   GET Asset Unified History
   Memadukan Log (PcHistory/Asset) dengan SpecHistory
=========================== */
router.get("/:id/history", verifyToken, async (req, res) => {
  try {
    const assetId = req.params.id;
    const asset = await Asset.findById(assetId).populate("pc");
    
    if (!asset) {
      return res.status(404).json({ message: "Asset not found" });
    }

    // 1. Ambil Log History berdasarkan serialNumber (atau pcId kalau log lama)
    // Karena saat ini PcHistory menyimpan pcId = serialNumber atau faNumber dll
    // Kita cek semua identifier yang mungkin merujuk pada aset ini
    const logFilter = {
      $or: [
        { pcId: asset.serialNumber },
        { pcId: asset.faNumber },
        { "newData.serialNumber": asset.serialNumber },
        { "oldData.serialNumber": asset.serialNumber }
      ]
    };
    if (asset.pc && asset.pc.pcId) {
      logFilter.$or.push({ pcId: asset.pc.pcId });
    }

    const logRecords = await PcHistory.find(logFilter).lean();

    // Mapping logRecords agar structure-nya seragam
    const formattedLogs = logRecords.map(log => ({
      _id: log._id,
      _type: "log", // penanda tipe history
      action: log.action, // edit / delete
      adminName: log.adminName,
      oldData: log.oldData,
      newData: log.newData,
      timestamp: log.timestamp || log.createdAt
    }));

    // 2. Ambil Spec History (berdasarkan referensi PC model jika asset punya PC terkait)
    let formattedSpecs = [];
    if (asset.pc && asset.pc._id) {
      const specRecords = await SpecHistory.find({ pc: asset.pc._id }).lean();
      formattedSpecs = specRecords.map(spec => ({
        _id: spec._id,
        _type: "spec",
        oldSpec: spec.oldSpec,
        newSpec: spec.newSpec,
        approved: spec.approved,
        rejected: spec.rejected,
        approvedBy: spec.approvedBy,
        reviewedAt: spec.reviewedAt,
        timestamp: spec.createdAt
      }));
    }

    // 3. Gabung dan sort by timestamp desc
    const unifiedHistory = [...formattedLogs, ...formattedSpecs].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    res.json(unifiedHistory);
  } catch (err) {
    console.error("❌ Gagal ambil unified history:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
