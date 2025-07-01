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

module.exports = router;
