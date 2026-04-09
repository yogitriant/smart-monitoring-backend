/**
 * 📦 Migration Script: Copy existing Pc data → Asset
 * 
 * Jalankan: node migrate-pc-to-asset.js
 * 
 * Script ini akan:
 * 1. Ambil semua Pc yang belum punya Asset record
 * 2. Populate Spec (brand, model, cpu, ram, gpu, os) dan PIC (name)
 * 3. Buat Asset record baru untuk setiap Pc
 * 4. Skip Pc yang sudah punya Asset (berdasarkan link pc ObjectId)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Pc = require("./models/Pc");
const Asset = require("./models/Asset");
const Spec = require("./models/Spec");
const Pic = require("./models/PicTemp");
const Location = require("./models/Location");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/smart-monitoring-db";

async function migrate() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected!\n");

  // Ambil semua Pc, populate pic, location, spec
  const allPcs = await Pc.find()
    .populate("pic")
    .populate("location")
    .populate("spec")
    .lean();

  console.log(`📊 Total PC ditemukan: ${allPcs.length}`);

  // Cek Pc mana yang sudah punya Asset
  const existingAssets = await Asset.find({ pc: { $ne: null } }).select("pc").lean();
  const linkedPcIds = new Set(existingAssets.map((a) => a.pc.toString()));

  console.log(`📦 Asset yang sudah ada (linked to Pc): ${linkedPcIds.size}`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const pc of allPcs) {
    // Skip kalau sudah ada Asset untuk Pc ini
    if (linkedPcIds.has(pc._id.toString())) {
      skipped++;
      continue;
    }

    try {
      // Determine sub category dari type
      const subCat = pc.type === "LT" ? "Laptop" : "Desktop";

      // Get PIC name
      const ownerName = pc.pic?.name || "";

      // Get location campus → site
      const siteName = pc.location?.campus || "";

      // Get spec data
      const spec = pc.spec || {};
      const customSpecs = [];
      if (spec.cpu) customSpecs.push({ key: "CPU", value: spec.cpu });
      if (spec.ram) customSpecs.push({ key: "RAM", value: spec.ram });
      if (spec.os) customSpecs.push({ key: "OS", value: spec.os });
      if (spec.gpu) customSpecs.push({ key: "GPU", value: spec.gpu });
      if (spec.resolution) customSpecs.push({ key: "Resolution", value: spec.resolution });
      if (spec.ipAddress && spec.ipAddress !== "-") customSpecs.push({ key: "IP Address", value: spec.ipAddress });
      if (spec.macAddress && spec.macAddress !== "-") customSpecs.push({ key: "MAC Address", value: spec.macAddress });

      // Disk info
      if (spec.disk && spec.disk.length > 0) {
        const diskSummary = spec.disk.map((d) => `${d.drive}: ${d.total || d.totalGB + " GB"} (${d.type})`).join(", ");
        customSpecs.push({ key: "Disk", value: diskSummary });
      }

      // FA Number dari assetNumber
      const faNumber = pc.assetNumber && pc.assetNumber !== "-" ? pc.assetNumber : undefined;

      const assetData = {
        faNumber,
        serialNumber: pc.serialNumber,
        productCategory: "Hardware",
        subCategory: subCat,
        status: "Deployed",
        site: siteName,
        ownerFullname: ownerName,
        brand: spec.brand || "",
        model: spec.model || "",
        customSpecs,
        pc: pc._id,
      };

      await Asset.create(assetData);
      created++;
      console.log(`  ✅ [${created}] ${pc.pcId} (${pc.serialNumber}) → Asset created`);
    } catch (err) {
      errors++;
      console.error(`  ❌ ${pc.pcId} (${pc.serialNumber}): ${err.message}`);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Migration Summary:");
  console.log(`   ✅ Created: ${created}`);
  console.log(`   ⏭️  Skipped (already exists): ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📦 Total PC: ${allPcs.length}`);
  console.log("=".repeat(50));

  await mongoose.disconnect();
  console.log("\n🔌 Disconnected. Done!");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
