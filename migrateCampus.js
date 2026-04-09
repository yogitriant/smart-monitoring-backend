const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const Location = require("./models/Location");
const Pc = require("./models/Pc");
const Asset = require("./models/Asset");
const RegionSiteItem = require("./models/RegionSiteItem");

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Terhubung ke DB...");

        // 1. Dapatkan daftar unik campus yang ada di sistem
        const rawLocations = await Location.find({});
        const campuses = [...new Set(rawLocations.map(l => l.campus).filter(Boolean))];
        console.log(`Ditemukan ${campuses.length} jenis campus unik di Location:`, campuses);

        // 2. Buat entri Master RegionSiteItem untuk tiap campus yang belum ada (sebagai site)
        const existingSites = await RegionSiteItem.find({ type: "site" });
        const existingSiteValues = new Set(existingSites.map(s => s.value.toLowerCase()));

        for (const campus of campuses) {
            if (!existingSiteValues.has(campus.toLowerCase())) {
                await RegionSiteItem.create({ type: "site", value: campus, parent: "MIGRATED_CAMPUS" });
                console.log(`+ Master Data Site baru dibuat: ${campus}`);
                existingSiteValues.add(campus.toLowerCase());
            }
        }

        // 3. Update field "site" pada tiap dokumen PC
        const pcs = await Pc.find().populate("location");
        let pcUpdates = 0;
        for (const pc of pcs) {
            if (pc.location && pc.location.campus) {
                pc.site = pc.location.campus;
                await pc.save();
                pcUpdates++;
            }
        }
        console.log(`✅ Update site berhasil pada ${pcUpdates} dokumen PC.`);

        // 4. Update field "site" pada tiap dokumen Asset (hanya yang belum diset)
        const assets = await Asset.find().populate("location");
        let assetUpdates = 0;
        for (const asset of assets) {
            if (!asset.site && asset.location && asset.location.campus) {
                asset.site = asset.location.campus;
                await asset.save();
                assetUpdates++;
            }
        }
        console.log(`✅ Update site berhasil pada ${assetUpdates} dokumen ASSET yang kosong.`);

        console.log("\n🚀 MIGRASI DB SELESAI. Selanjutnya, Anda boleh menghapus atribut 'campus' pada skema secara manual.");
        process.exit(0);
    } catch (e) {
        console.error("Terjadi masalah migrasi:", e);
        process.exit(1);
    }
}

migrate();
