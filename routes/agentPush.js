// routes/agentPush.js
const express = require("express");
const router = express.Router();
const AgentUpdateLog = require("../models/AgentUpdateLog");

router.post("/push", async (req, res) => {
  const { action, version, pcIds } = req.body;

  if (!action || !version || !Array.isArray(pcIds)) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const logsToInsert = pcIds.map((pcId) => ({
      pcId,
      version,
      action,
      status: "processing",
      message: `Memproses instruksi ${action}...`,
      timestamp: new Date(),
    }));

    await AgentUpdateLog.insertMany(logsToInsert);
    res.json({ success: true, message: "Push accepted and logs created" });
  } catch (err) {
    console.error("Error inserting push logs:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
