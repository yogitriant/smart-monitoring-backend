// routes/agentPush.js
const express = require("express");
const router = express.Router();

router.post("/push", async (req, res) => {
  const { action, version, pcIds } = req.body;

  if (!action || !version || !Array.isArray(pcIds)) {
    return res.status(400).json({ error: "Missing fields" });
  }

  // Tidak perlu proses di sini karena hanya frontend yang trigger via socket
  res.json({ success: true, message: "Push accepted" });
});

module.exports = router;
