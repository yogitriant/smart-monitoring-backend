// routes/log.js
const express = require("express");
const router = express.Router();
const PcHistory = require("../models/PcHistory");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");

// GET unified PC history log (edit + delete)
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const logs = await PcHistory.find().sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    console.error("❌ Gagal ambil log histori PC:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
