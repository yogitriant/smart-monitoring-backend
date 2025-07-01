const express = require("express");
const router = express.Router();
const Config = require("../models/Config");

// GET /api/version → info update terbaru
router.get("/", async (req, res) => {
  try {
    const latestConfig = await Config.findOne().sort({ updatedAt: -1 });

    if (!latestConfig) {
      return res.status(404).json({ message: "Config not found" });
    }

    res.json({
      latestVersion: latestConfig.latestVersion,
      updateUrl: latestConfig.updateUrl,
      forceUpdate: latestConfig.forceUpdate,
      note: latestConfig.note,
    });
  } catch (err) {
    console.error("❌ Error fetching config:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
