const express = require("express");
const router = express.Router();
const Pc = require("../models/Pc");
const Spec = require("../models/Spec");
const Performance = require("../models/Performance");
const Uptime = require("../models/Uptime");
const Asset = require("../models/Asset");
const verifyToken = require("../middleware/verifyToken");
const dayjs = require("dayjs");

router.get("/:id", async (req, res) => {
  try {
    // 1. Ambil PC + lokasi
    const pc = await Pc.findById(req.params.id).populate("location").populate("pic", "name email department phone");

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

    // 5. Fallback site dari Asset jika PC belum punya
    let site = pc.site || "";
    if (!site) {
      const linkedAsset = await Asset.findOne({ pc: pc._id }).select("site").lean();
      if (linkedAsset?.site) site = linkedAsset.site;
    }

    // 6. Gabungkan semua ke response
    const response = {
      ...pc.toObject(),
      site,
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
