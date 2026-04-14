// routes/log.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const PcHistory = require("../models/PcHistory");
const Location = require("../models/Location");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");

// GET unified PC history log (edit + delete)
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const logs = await PcHistory.find().sort({ createdAt: -1 }).lean();

    // Collect all unique location ObjectIds from oldData/newData
    const locIds = new Set();
    logs.forEach((log) => {
      [log.oldData?.location, log.newData?.location].forEach((loc) => {
        if (loc && mongoose.isValidObjectId(String(loc))) locIds.add(String(loc));
      });
    });

    // Resolve location names
    const locMap = {};
    if (locIds.size > 0) {
      const locs = await Location.find({ _id: { $in: [...locIds] } })
        .select("campus room category")
        .lean();
      locs.forEach((l) => {
        locMap[l._id.toString()] = `${l.room || "-"} (${l.category || "-"})`;
      });
    }

    // Enrich logs with readable location
    const enriched = logs.map((log) => {
      const enrichOne = (data) => {
        if (!data) return data;
        const locStr = String(data.location || "");
        if (locStr && locMap[locStr]) {
          return { ...data, location: locMap[locStr] };
        }
        return data;
      };
      return {
        ...log,
        oldData: enrichOne(log.oldData),
        newData: enrichOne(log.newData),
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error("❌ Gagal ambil log histori PC:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
