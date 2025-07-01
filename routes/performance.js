const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Performance = require("../models/Performance");

// ✅ GET /api/performance/summary
router.get("/summary", async (req, res) => {
  const { hours = 1, pcId } = req.query;

  const match = {};
  if (pcId) match.pc = pcId;

  try {
    const result = await Performance.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          avgCpu: { $avg: "$cpuUsage" },
          avgRam: { $avg: "$ramUsage" },
          // ⛔ avgDisk dihapus karena diskUsage berupa array
        },
      },
    ]);

    if (result.length === 0) {
      return res.json({ avgCpu: 0, avgRam: 0 });
    }

    res.json(result[0]);
  } catch (err) {
    console.error("❌ Error get summary:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ POST /api/performance
router.post("/", async (req, res) => {
  try {
    const {
      pc,
      cpuUsage,
      ramUsage,
      diskUsage,
      uptime,
      agentUptime,
      idleTime,
      timestamp,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(pc)) {
      return res.status(400).json({ message: "Invalid PC ID" });
    }

    if (!Array.isArray(diskUsage)) {
      return res.status(400).json({ message: "diskUsage must be an array" });
    }

    const performance = new Performance({
      pc,
      cpuUsage,
      ramUsage,
      diskUsage,
      uptime,
      agentUptime,
      idleTime,
      timestamp: timestamp || new Date(),
    });

    await performance.save();
    res.status(201).json({ message: "Performance data saved" });
  } catch (err) {
    console.error("❌ Failed to save performance:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ GET /api/performance
router.get("/", async (req, res) => {
  try {
    const data = await Performance.find()
      .populate("pc")
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Gagal mengambil data performance" });
  }
});

// ✅ GET /api/performance/:pcId
router.get("/:pcId", async (req, res) => {
  try {
    const { pcId } = req.params;
    const data = await Performance.find({ pc: pcId })
      .sort({ timestamp: -1 })
      .limit(100);

    res.json(data);
  } catch (err) {
    console.error("❌ Gagal ambil performance:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
