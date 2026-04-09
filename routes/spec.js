
// routes/spec.js
const express = require("express");
const router = express.Router();
const { processSpec } = require("../services/specProcessor");

/* ===========================
   POST /api/spec
   Menggunakan shared specProcessor
=========================== */
router.post("/", async (req, res) => {
  try {
    const result = await processSpec(req.body);
    return res.status(result.status).json({ message: result.message });
  } catch (err) {
    console.error("❌ Error saving spec:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

