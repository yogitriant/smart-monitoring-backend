const express = require("express");
const router = express.Router();
const Pc = require("../models/Pc");
const Spec = require("../models/Spec");
const Performance = require("../models/Performance");
const Uptime = require("../models/Uptime");
const verifyToken = require("../middleware/verifyToken");
const dayjs = require("dayjs");

router.get("/:id", verifyToken, async (req, res) => {
  try {
    // 1. Ambil PC + lokasi
    const pc = await Pc.findById(req.params.id).populate("location");

    if (!pc) {
      return res.status(404).json({ message: "PC not found" });
    }

    // 2. Ambil spesifikasi berdasarkan PC
    const spec = await Spec.findOne({ pc: pc._id });

    // 3. Ambil data performa terbaru
    const latestPerformance = await Performance.findOne({ pc: pc._id }).sort({
      timestamp: -1,
    });

    // 4. Ambil data uptime hari ini
    const today = dayjs().format("YYYY-MM-DD");
    const uptime = await Uptime.findOne({ pc: pc._id, date: today });

    // 5. Gabungkan semua ke response
    const response = {
      ...pc.toObject(),
      spec: spec || null,
      performance: {
        ...(latestPerformance?.toObject() || {}),
        uptimeTotal: uptime?.uptimeTotal || 0, // ⬅️ inject ke performance
      },
    };

    res.json(response);
  } catch (err) {
    console.error("❌ Error get PC by id:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
