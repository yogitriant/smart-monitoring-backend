// scripts/cleanDuplicatePending.js
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

    // Ambil semua spec history yang MURNI pending
    const pendings = await SpecHistory.find({ approved: false, rejected: false }).sort({ createdAt: 1 });
    
    // Kelompokkan by PC
    const byPc = {};
    for (const p of pendings) {
      const pcIdStr = p.pc.toString();
      if (!byPc[pcIdStr]) byPc[pcIdStr] = [];
      byPc[pcIdStr].push(p);
    }

    let deletedCount = 0;
    
    for (const pcIdStr in byPc) {
      const items = byPc[pcIdStr];
      if (items.length > 1) {
        // Sisakan 1 yang paling baru (index terakhir)
        const toDelete = items.slice(0, items.length - 1).map((i) => i._id);
        const res = await SpecHistory.deleteMany({ _id: { $in: toDelete } });
        deletedCount += res.deletedCount;
      }
    }

    console.log(`✅ Berhasil membersihkan ${deletedCount} duplikat pending spec history.`);

  } catch (err) {
    console.error("❌ Error during cleanup:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Selesai.");
    process.exit(0);
  }
}

run();
