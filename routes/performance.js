const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Performance = require("../models/Performance");
const Pc = require("../models/Pc");
const { applyIdleThreshold } = require("../utils/idleHelper");

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
      idleTime, // raw dari agent (detik)
      timestamp,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(pc)) {
      return res.status(400).json({ message: "Invalid PC ID" });
    }
    if (!Array.isArray(diskUsage)) {
      return res.status(400).json({ message: "diskUsage must be an array" });
    }

    // 🔹 Ambil threshold dari PC (default 300 detik)
    const pcDoc = await Pc.findById(pc).lean();
    const threshold = pcDoc?.idleTimeout || 300;

    // 🔹 Hitung status + idleTime after threshold
    const { status, idleTime: idleFor } = applyIdleThreshold(idleTime, threshold);

    // 🔍 Debug log
    console.log(
      `[PERFORMANCE DEBUG] PC=${pcDoc?.pcId || pc} | raw=${idleTime}s | afterThreshold=${idleFor}s | threshold=${threshold}s | status=${status}`
    );

    // Simpan ke riwayat Performance
    const performance = new Performance({
      pc,
      cpuUsage,
      ramUsage,
      diskUsage,
      uptime,
      agentUptime,
      idleRaw: idleTime,   // raw dari agent
      idleTime: idleFor,   // hasil setelah threshold
      timestamp: timestamp || new Date(),
    });
    await performance.save();

    // Update snapshot terbaru di Pc
    await Pc.updateOne(
      { _id: pc },
      {
        $set: {
          status,                          // "online" / "idle"
          "performance.cpuUsage": cpuUsage,
          "performance.ramUsage": ramUsage,
          "performance.idleRaw": idleTime, // raw
          "performance.idleTime": idleFor, // after threshold
          lastActive: new Date(),
        },
      }
    );

    res.status(201).json({
      message: "Performance data saved",
      status,
      idleRaw: idleTime,
      idleFor,
      threshold,
    });
  } catch (err) {
    console.error("❌ Failed to save performance:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ GET /api/performance (semua PC, max 100)
router.get("/", async (req, res) => {
  try {
    const data = await Performance.find()
      .populate("pc")
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    res.json(data); // langsung kirim idleRaw & idleTime dari DB
  } catch (err) {
    console.error("❌ Gagal ambil performance:", err.message);
    res.status(500).json({ message: "Gagal mengambil data performance" });
  }
});

// ✅ GET /api/performance/:pcId (100 riwayat per PC)
router.get("/:pcId", async (req, res) => {
  try {
    const { pcId } = req.params;
    const data = await Performance.find({ pc: pcId })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    res.json(data);
  } catch (err) {
    console.error("❌ Gagal ambil performance:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
