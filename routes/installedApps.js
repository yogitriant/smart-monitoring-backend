const express = require("express");
const router = express.Router();
const InstalledApp = require("../models/InstalledApp");
const PC = require("../models/Pc");

// POST /api/installed-apps
router.post("/", async (req, res) => {
  const { pcId, apps } = req.body;

  try {
    const pc = await PC.findOne({ pcId });
    if (!pc) {
      return res.status(404).json({ message: "PC tidak ditemukan" });
    }

    const saved = await InstalledApp.create({
      pc: pc._id,
      apps,
    });

    res.json(saved);
  } catch (err) {
    console.error("❌ Gagal simpan installed apps:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/installed-apps/pcid/:pcId
router.get("/pcid/:pcId", async (req, res) => {
  try {
    const pc = await PC.findOne({ pcId: req.params.pcId });
    if (!pc) {
      return res.status(404).json({ message: "PC tidak ditemukan" });
    }

    const data = await InstalledApp.find({ pc: pc._id })
      .sort({ createdAt: -1 })
      .limit(1);

    res.json(data[0] || {});
  } catch (err) {
    console.error("❌ Gagal ambil installed apps:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/installed-apps/by-id/:id
router.get("/by-id/:id", async (req, res) => {
  try {
    const pc = await PC.findById(req.params.id);
    if (!pc) return res.status(404).json({ message: "PC tidak ditemukan" });

    const installed = await InstalledApp.findOne({ pc: pc._id });
    if (!installed)
      return res.status(404).json({ message: "Belum ada data aplikasi" });

    res.json(installed);
  } catch (err) {
    console.error("❌ Gagal ambil data installed apps:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
