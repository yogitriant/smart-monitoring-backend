const express = require("express");
const router = express.Router();
const Pc = require("../models/Pc");
const Config = require("../models/Config");

// GET /api/pc/:serialNumber/config
router.get("/:serialNumber/config", async (req, res) => {
  try {
    const pc = await Pc.findOne({ serialNumber: req.params.serialNumber });

    if (!pc) return res.status(404).json({ message: "PC not found" });

    const globalConfig = await Config.findOne().sort({ updatedAt: -1 });

    res.json({
      idleTimeout: pc.idleTimeout ?? 0,
      shutdownDelay: pc.shutdownDelay ?? 60,
      latestVersion: globalConfig?.latestVersion ?? "1.0.0",
      updateUrl: globalConfig?.updateUrl ?? "",
      forceUpdate: globalConfig?.forceUpdate ?? false,
    });
  } catch (err) {
    console.error("❌ Gagal ambil config:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
