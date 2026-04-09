const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const IdleLog = require("../models/IdleLog");
const Pc = require("../models/Pc");

/**
 * ✅ POST /api/idle-log/bulk
 * Terima batch idle logs dari agent
 */
router.post("/bulk", async (req, res) => {
  try {
    const { pc, logs } = req.body;
    if (!pc || !Array.isArray(logs)) {
      return res.status(400).json({ message: "pc dan logs wajib diisi" });
    }

    const docs = logs.map((item) => ({
      pc,
      idleRaw: item.idle,
      status: item.idle >= 300 ? "idle" : "online",
      timestamp: item.timestamp || new Date(),
    }));

    if (docs.length > 1000) {
      return res.status(400).json({ message: "Terlalu banyak log dikirim (maksimal 1000 per batch)" });
    }

    // unordered insert agar error 1 data tidak membatalkan semuanya
    await IdleLog.insertMany(docs, { ordered: false });
    await Pc.updateOne({ _id: pc }, { $set: { lastActive: new Date() } });

    res.status(201).json({ message: `Idle logs (${docs.length}) saved` });
  } catch (err) {
    console.error("❌ Failed to bulk insert idle logs:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * ✅ GET /api/idle-log/summary/:pcId
 * Rekap idle per jam (hari ini)
 */
router.get("/summary/:pcId", async (req, res) => {
  try {
    const { pcId } = req.params;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const data = await IdleLog.aggregate([
      { $match: { pc: new mongoose.Types.ObjectId(pcId), timestamp: { $gte: startOfDay } } },
      {
        $group: {
          _id: {
            hour: { $hour: "$timestamp" },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.hour": 1 } },
    ]);

    // Format agar lebih ramah frontend
    const result = data.map((d) => ({
      hour: d._id.hour,
      status: d._id.status,
      count: d.count,
    }));

    res.json(result);
  } catch (err) {
    console.error("❌ Gagal ambil summary idle:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
