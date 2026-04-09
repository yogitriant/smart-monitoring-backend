// scripts/cleanSpecAnomaly.js
require("dotenv").config();
const mongoose = require("mongoose");
const SpecHistory = require("../models/SpecHistory");

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("📦 Connected to MongoDB");

    // Cari anomali:
    // 1. newSpec.os cuma "x64" (terkadang " x64" atau persis "x64")
    // 2. newSpec.cpu kosong atau cuma white space
    // 3. disk array kosong tapi di oldSpec disk tidak kosong
    const anomalies = await SpecHistory.find({
      $or: [
        { "newSpec.os": "x64" },
        { "newSpec.os": " x64" },
        { "newSpec.cpu": "" },
        { "newSpec.cpu": " " },
        { "newSpec.cpu": { $exists: false } },
      ],
    });

    console.log(`🔍 Found ${anomalies.length} anomalous SpecHistory records.`);

    if (anomalies.length > 0) {
      const ids = anomalies.map(a => a._id);
      const result = await SpecHistory.deleteMany({ _id: { $in: ids } });
      console.log(`✅ Deleted ${result.deletedCount} anomalous records.`);
    } else {
      console.log("✨ No anomalies to clean.");
    }

  } catch (err) {
    console.error("❌ Error during cleanup:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Selesai.");
    process.exit(0);
  }
}

run();
