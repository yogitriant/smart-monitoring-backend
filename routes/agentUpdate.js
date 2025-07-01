// routes/agentUpdate.js
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const AgentVersion = require("../models/AgentVersion");
const AgentUpdateLog = require("../models/AgentUpdateLog"); // ⬅️ Tambahkan model untuk logs jika belum

const router = express.Router();
const upload = multer({ dest: "tmp/" });

// Upload agent version ZIP
router.post("/upload", upload.single("agentZip"), async (req, res) => {
  try {
    const { version, changelog, uploadedBy } = req.body;
    const file = req.file;

    if (!version || !file) {
      return res.status(400).json({ error: "Version & file required" });
    }

    const existing = await AgentVersion.findOne({ version });
    if (existing)
      return res.status(400).json({ error: "Version already exists" });

    const fileBuffer = fs.readFileSync(file.path);
    const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    const targetDir = path.join("public", "agent_versions", version);

    fs.mkdirSync(targetDir, { recursive: true });
    const destPath = path.join(targetDir, "agent.zip");
    fs.renameSync(file.path, destPath);

    await AgentVersion.create({
      version,
      changelog,
      uploadedBy,
      hash,
    });

    res.status(200).json({ message: "Upload successful", version, hash });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Get agent update logs
router.get("/logs", async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  try {
    const logs = await AgentUpdateLog.find()
      .sort({ timestamp: -1 })
      .limit(limit);
    res.json(logs);
  } catch (err) {
    console.error("❌ Gagal ambil logs:", err.message);
    res.status(500).json({ error: "Gagal ambil logs" });
  }
});

module.exports = router;
