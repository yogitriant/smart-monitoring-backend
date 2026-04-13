// seed-geo-coordinates.js
// Jalankan: node seed-geo-coordinates.js
// Isi koordinat gedung untuk fitur Geo Map

require("dotenv").config();
const mongoose = require("mongoose");
const RegionSiteItem = require("./models/RegionSiteItem");

// Daftar koordinat gedung — sesuaikan dengan site yang ada di Master Data
const SITE_COORDINATES = [
  // ─── Contoh: Binus University ──────────────────
  { site: "Anggrek",   lat: -6.2018,  lng: 106.7812 },  // Binus Anggrek, Jakarta Barat
  { site: "Syahdan",   lat: -6.2005,  lng: 106.7834 },  // Binus Syahdan, Jakarta Barat
  { site: "Alam Sutera", lat: -6.2560, lng: 106.6513 },  // Binus Alam Sutera, Tangerang
  { site: "Bekasi",    lat: -6.2466,  lng: 107.0032 },  // Binus Bekasi
  { site: "Malang",    lat: -7.9425,  lng: 112.6152 },  // Binus Malang
  { site: "Bandung",   lat: -6.9023,  lng: 107.6186 },  // Binus Bandung
  { site: "Semarang",  lat: -6.9932,  lng: 110.4203 },  // Binus Semarang

  // ─── Tambahkan site lainnya di bawah ini ───────
  // { site: "NamaGedung", lat: -6.xxxx, lng: 106.xxxx },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    let updated = 0;
    let skipped = 0;

    for (const entry of SITE_COORDINATES) {
      // Cari RegionSiteItem yang sitany cocok
      const result = await RegionSiteItem.updateMany(
        {
          site: { $regex: new RegExp(`^${entry.site}$`, "i") },
          $or: [{ lat: null }, { lat: { $exists: false } }]
        },
        {
          $set: {
            lat: entry.lat,
            lng: entry.lng
          }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`📍 ${entry.site}: ${result.modifiedCount} records updated (${entry.lat}, ${entry.lng})`);
        updated += result.modifiedCount;
      } else {
        console.log(`⏭️ ${entry.site}: skipped (already has coordinates or not found)`);
        skipped++;
      }
    }

    console.log(`\n🎯 Done! Updated: ${updated}, Skipped: ${skipped}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

seed();
