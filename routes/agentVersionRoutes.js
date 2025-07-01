const express = require("express");
const fs = require("fs");
const path = require("path");
const AgentVersion = require("../models/AgentVersion");
const router = express.Router();

// ✅ Ambil daftar versi
router.get("/versions", async (req, res) => {
  try {
    const versions = await AgentVersion.find()
      .sort({ uploadDate: -1 })
      .select("version uploadDate changelog");
    res.json(versions);
  } catch (err) {
    console.error("❌ Gagal ambil versi:", err.message);
    res.status(500).json({ error: "Failed to fetch versions" });
  }
});

// ✅ Hapus versi + folder
router.delete("/versions/:version", async (req, res) => {
  const { version } = req.params;
  try {
    // 1️⃣ Hapus dari database
    const deleted = await AgentVersion.findOneAndDelete({ version });
    if (!deleted) {
      return res.status(404).json({ error: "Version not found in DB" });
    }

    // 2️⃣ Hapus dari folder public
    const folderPath = path.join(
      __dirname,
      "..",
      "public",
      "agent_versions",
      version
    );
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true });
      console.log(`🗑️ Folder versi ${version} dihapus:`, folderPath);
    } else {
      console.warn(
        `⚠️ Folder versi ${version} tidak ditemukan di path:`,
        folderPath
      );
    }

    res.json({ message: `Versi ${version} berhasil dihapus.` });
  } catch (err) {
    console.error("❌ Gagal hapus versi:", err.message);
    res.status(500).json({ error: "Failed to delete version." });
  }
});

module.exports = router;
