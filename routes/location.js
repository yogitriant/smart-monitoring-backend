const express = require("express");
const router = express.Router();
const Location = require("../models/Location");

// 🔍 Ambil semua lokasi
router.get("/", async (req, res) => {
  try {
    const locations = await Location.find().sort({ campus: 1, room: 1 });
    res.json(locations);
  } catch (err) {
    console.error("❌ Gagal ambil lokasi:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// 🔍 Ambil kategori lokasi unik
router.get("/categories", async (req, res) => {
  try {
    const categories = await Location.distinct("category");
    res.json(categories);
  } catch (err) {
    console.error("❌ Gagal ambil kategori:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// POST to create a new location
router.post("/", async (req, res) => {
  try {
    const { category, room, floor } = req.body;
    const location = await Location.create({ category, room, floor });
    res.status(201).json(location);
  } catch (err) {
    console.error("❌ Gagal buat lokasi:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT to update an existing location
router.put("/:id", async (req, res) => {
  try {
    const { category, room, floor } = req.body;
    const location = await Location.findByIdAndUpdate(
      req.params.id,
      { category, room, floor },
      { new: true, runValidators: true }
    );
    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }
    res.json(location);
  } catch (err) {
    console.error("❌ Gagal update lokasi:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE a location
router.delete("/:id", async (req, res) => {
  try {
    const location = await Location.findByIdAndDelete(req.params.id);
    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }
    res.json({ message: "Location deleted successfully" });
  } catch (err) {
    console.error("❌ Gagal hapus lokasi:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
