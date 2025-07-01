// routes/settings.js
const express = require("express");
const router = express.Router();
const Setting = require("../models/Setting");
const Location = require("../models/Location");
const PC = require("../models/Pc");

// GET settings
router.get("/", async (req, res) => {
  try {
    const setting = await Setting.findOne();
    res.json(setting || {});
  } catch (err) {
    res.status(500).json({ message: "Gagal mengambil settings" });
  }
});
// ✅ GET config agent berdasarkan pcId
router.get("/agent-config/:id", async (req, res) => {
  try {
    const pc = await PC.findById(req.params.id); // ✅ benar karena yang dikirim adalah _id
    if (!pc) return res.status(404).json({ message: "PC not found" });

    const config = {
      idleTimeout: pc.idleTimeout || 0,
      shutdownDelay: pc.shutdownDelay || 60,
      uptimeInterval: 10,
    };

    res.json(config);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST settings
// POST settings
router.post("/", async (req, res) => {
  try {
    const { defaultTimeout, categoryTimeouts, uptimeInterval } = req.body;

    let updatedLocationIds = [];
    let affectedPcIds = new Set();

    for (const item of categoryTimeouts) {
      const locs = await Location.find({ category: item.category });
      const locationIds = locs.map((loc) => loc._id);
      updatedLocationIds.push(...locationIds);

      const updatedPcs = await PC.find({ location: { $in: locationIds } });
      updatedPcs.forEach((pc) => affectedPcIds.add(pc._id.toString()));

      await PC.updateMany(
        { location: { $in: locationIds } },
        { idleTimeout: item.timeout }
      );
    }

    // Update default timeout untuk sisanya
    const otherPcs = await PC.find({ location: { $nin: updatedLocationIds } });
    otherPcs.forEach((pc) => affectedPcIds.add(pc._id.toString()));
    await PC.updateMany(
      { location: { $nin: updatedLocationIds } },
      { idleTimeout: defaultTimeout }
    );

    await Setting.findOneAndUpdate(
      {},
      { defaultTimeout, categoryTimeouts, uptimeInterval },
      { upsert: true, new: true }
    );

    // ✅ Emit ke masing-masing agent berdasarkan pcId
    const { io } = require("../socket");
    const affectedPcs = await PC.find({
      _id: { $in: Array.from(affectedPcIds) },
    });
    for (const pc of affectedPcs) {
      io.to(pc.pcId).emit("agent-config-updated");
    }

    res.json({ message: "Pengaturan disimpan & agent diupdate" });
  } catch (err) {
    console.error("❌ Gagal simpan settings:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
