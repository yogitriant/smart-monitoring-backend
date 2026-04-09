// scripts/migratePerformanceInterval.js
require("dotenv").config();
const mongoose = require("mongoose");
const Pc = require("../models/Pc");

(async () => {
  try {
    console.log("🚀 Memulai migrasi performanceInterval...");

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Terhubung ke MongoDB");

    // Update hanya dokumen yang belum punya performanceInterval
    const result = await Pc.updateMany(
      { performanceInterval: { $exists: false } },
      { $set: { performanceInterval: 3600 } } // default 1 jam (detik)
    );

    console.log(`✅ Migrasi selesai. ${result.modifiedCount} PC diperbarui.`);
    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ Migrasi gagal:", err.message);
    process.exit(1);
  }
})();
