const mongoose = require("mongoose");
require("dotenv").config();

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const db = mongoose.connection.db;
        const collection = db.collection("pcs");

        // Cek dulu isi performanceInterval yang ada
        const sample = await collection.find({}, { projection: { pcId: 1, performanceInterval: 1 } }).toArray();
        console.log("Current values:");
        sample.forEach(pc => console.log(`  ${pc.pcId}: ${pc.performanceInterval} (type: ${typeof pc.performanceInterval})`));

        // Update semua PC yang performanceInterval-nya 3600 (baik number maupun belum pernah diubah)
        const result = await collection.updateMany(
            { $or: [
                { performanceInterval: 3600 },
                { performanceInterval: { $exists: false } }
            ]},
            { $set: { performanceInterval: 0 } }
        );

        console.log(`\nMigrated ${result.modifiedCount} PCs to performanceInterval=0.`);

        // Verifikasi
        const after = await collection.find({}, { projection: { pcId: 1, performanceInterval: 1 } }).toArray();
        console.log("\nAfter migration:");
        after.forEach(pc => console.log(`  ${pc.pcId}: ${pc.performanceInterval}`));
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        mongoose.connection.close();
    }
}
migrate();
