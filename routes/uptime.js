const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Uptime = require("../models/Uptime");
const PC = require("../models/Pc");
const Location = require("../models/Location");

// POST /api/uptime
router.post("/", async (req, res) => {
  const { pc, date, uptimeTotalToday, uptimeSession } = req.body;

  try {
    const updated = await Uptime.findOneAndUpdate(
      { pc, date },
      {
        $set: {
          uptimeTotalToday,
          uptimeSession,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(updated);
  } catch (err) {
    console.error("❌ Gagal simpan uptime:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/uptime?pc=...&date=...
router.get("/", async (req, res) => {
  const { pc, date } = req.query;

  try {
    const matchPc = mongoose.Types.ObjectId.isValid(pc)
      ? new mongoose.Types.ObjectId(pc)
      : pc;

    const record = await Uptime.findOne({ pc: matchPc, date });
    res.json(record || {}); // Tetap kembalikan objek kosong jika tidak ada
  } catch (err) {
    console.error("❌ Gagal ambil uptime:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/uptime/summary/monthly?month=2025-06
router.get("/summary/monthly", async (req, res) => {
  const { month } = req.query;

  try {
    const result = await Uptime.aggregate([
      { $match: { date: { $regex: `^${month}` } } },
      {
        $lookup: {
          from: "pcs",
          localField: "pc",
          foreignField: "_id",
          as: "pc",
        },
      },
      { $unwind: "$pc" },
      {
        $lookup: {
          from: "locations",
          localField: "pc.location",
          foreignField: "_id",
          as: "location",
        },
      },
      { $unwind: "$location" },
      {
        $group: {
          _id: "$location.campus", // ganti ke "$location.room" jika mau per-ruangan
          totalUptimeSeconds: { $sum: "$uptimeTotalToday" },
        },
      },
      { $sort: { totalUptimeSeconds: -1 } },
    ]);

    res.json(result);
  } catch (err) {
    console.error("❌ Gagal ambil summary uptime:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/uptime/total/:pcId → total uptime semua hari
router.get("/total/:pcId", async (req, res) => {
  const { pcId } = req.params;

  try {
    const result = await Uptime.aggregate([
      { $match: { pc: new mongoose.Types.ObjectId(pcId) } },
      {
        $group: {
          _id: "$pc",
          uptimeLifetime: { $sum: "$uptimeTotalToday" },
        },
      },
    ]);

    res.json({
      pc: pcId,
      uptimeLifetime: result[0]?.uptimeLifetime || 0,
    });
  } catch (err) {
    console.error("❌ Gagal ambil total uptime:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
