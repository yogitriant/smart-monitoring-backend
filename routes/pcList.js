const express = require("express");
const router = express.Router();
const Pc = require("../models/Pc");
const Spec = require("../models/Spec");
const Location = require("../models/Location");
const Performance = require("../models/Performance");
const verifyToken = require("../middleware/verifyToken");

router.get("/", verifyToken, async (req, res) => {
  try {
    const { campus, category, room } = req.query;

    // 🔍 Filter lokasi
    const locationFilter = {};
    if (campus) locationFilter.campus = campus;
    if (category) locationFilter.category = category;
    if (room) locationFilter.room = room;

    const matchedLocations = await Location.find(locationFilter);
    const locationIds = matchedLocations.map((loc) => loc._id);

    // 🎯 Ambil PC dari lokasi tersebut
    const pcs = await Pc.find({ location: { $in: locationIds } })
      .populate("location")
      .sort({ updatedAt: -1 });

    const pcIds = pcs.map((pc) => pc._id);

    // Ambil semua spec dan performance terbaru
    const specs = await Spec.find({ pc: { $in: pcIds } });

    const performances = await Promise.all(
      pcIds.map((id) => Performance.findOne({ pc: id }).sort({ timestamp: -1 }))
    );

    // Gabungkan data per PC
    const result = pcs.map((pc) => {
      const spec = specs.find((s) => s.pc.toString() === pc._id.toString());
      const performance = performances.find(
        (p) => p && p.pc.toString() === pc._id.toString()
      );

      return {
        ...pc.toObject(),
        spec,
        performance,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("❌ Gagal ambil daftar PC:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});
// GET /api/pc/list-with-location
router.get("/list-with-location", verifyToken, async (req, res) => {
  try {
    const pcs = await Pc.find()
      .populate("location", "name campus category room")
      .sort({ pcId: 1 })
      .select(
        "pcId pic serialNumber assetNumber userLogin status location idleTimeout isAdmin"
      );

    res.json(pcs);
  } catch (err) {
    console.error("❌ Gagal ambil list PC+lokasi:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
