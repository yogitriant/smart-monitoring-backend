const express = require("express");
const router = express.Router();
const FieldOption = require("../models/FieldOption");
const verifyToken = require("../middleware/verifyToken");

router.use(verifyToken);

// GET all field options, optionally filtered by type
router.get("/", async (req, res) => {
  try {
    const { type, parent } = req.query;
    const query = {};
    if (type) query.type = type;
    if (parent) query.parent = parent;
    const options = await FieldOption.find(query).sort({ type: 1, value: 1 });
    res.json(options);
  } catch (err) {
    console.error("❌ Gagal ambil field options:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// POST to create a new field option
router.post("/", async (req, res) => {
  try {
    const { type, value, parent } = req.body;
    if (!type || !value) {
      return res.status(400).json({ message: "Type and value are required" });
    }
    const option = await FieldOption.create({ type, value, parent: parent || null });
    res.status(201).json(option);
  } catch (err) {
    console.error("❌ Gagal buat field option:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT to update an existing field option
router.put("/:id", async (req, res) => {
  try {
    const { type, value, parent } = req.body;
    const option = await FieldOption.findByIdAndUpdate(
      req.params.id,
      { type, value, parent: parent || null },
      { new: true, runValidators: true }
    );
    if (!option) {
      return res.status(404).json({ message: "Field option not found" });
    }
    res.json(option);
  } catch (err) {
    console.error("❌ Gagal update field option:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE a field option
router.delete("/:id", async (req, res) => {
  try {
    const option = await FieldOption.findByIdAndDelete(req.params.id);
    if (!option) {
      return res.status(404).json({ message: "Field option not found" });
    }
    res.json({ message: "Field option deleted successfully" });
  } catch (err) {
    console.error("❌ Gagal hapus field option:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
