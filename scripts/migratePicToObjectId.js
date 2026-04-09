/**
 * Migration: Konversi field `pic` dari String ke ObjectId di koleksi Pc
 *
 * Script ini:
 * 1. Mencari semua dokumen Pc yang field `pic` bertipe string
 * 2. Untuk setiap string, cari PicTemp yang cocok (by name)
 * 3. Jika ditemukan, update field pic ke ObjectId-nya
 * 4. Jika tidak ditemukan, buat PicTemp baru lalu update
 *
 * Jalankan: node scripts/migratePicToObjectId.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Pc = require("../models/Pc");
const PicTemp = require("../models/PicTemp");

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB");

  // Cari semua PC yang pic-nya bertipe string
  const pcsWithStringPic = await Pc.find({ pic: { $type: "string" } }).lean();
  console.log(`📋 Ditemukan ${pcsWithStringPic.length} PC dengan pic bertipe string`);

  let converted = 0;
  let created = 0;
  let skipped = 0;

  for (const pc of pcsWithStringPic) {
    const picName = String(pc.pic).trim();

    // Skip jika kosong atau "-"
    if (!picName || picName === "-" || picName === "null") {
      await Pc.updateOne({ _id: pc._id }, { $unset: { pic: "" } });
      skipped++;
      continue;
    }

    // Cari PicTemp yang sudah ada
    let picDoc = await PicTemp.findOne({
      name: { $regex: new RegExp(`^${picName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });

    // Jika belum ada, buat baru
    if (!picDoc) {
      picDoc = await PicTemp.create({
        name: picName,
        email: "-",
        department: "-",
      });
      created++;
      console.log(`  🆕 Created PicTemp: "${picName}" → ${picDoc._id}`);
    }

    // Update PC dengan ObjectId
    await Pc.updateOne({ _id: pc._id }, { $set: { pic: picDoc._id } });
    converted++;
    console.log(`  ✅ PC ${pc.pcId}: "${picName}" → ObjectId(${picDoc._id})`);
  }

  console.log("\n📊 Migration Summary:");
  console.log(`  Converted: ${converted}`);
  console.log(`  New PicTemp created: ${created}`);
  console.log(`  Skipped (empty/null): ${skipped}`);
  console.log(`  Total processed: ${pcsWithStringPic.length}`);

  await mongoose.disconnect();
  console.log("✅ Disconnected from MongoDB");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
