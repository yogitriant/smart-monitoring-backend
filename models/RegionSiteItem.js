const mongoose = require("mongoose");

const regionSiteItemSchema = new mongoose.Schema({
    region: { type: String, default: "" },
    siteGroup: { type: String, default: "" },
    site: { type: String, default: "" },
    division: { type: String, default: "" },
    department: { type: String, default: "" },
    ownerSite: { type: String, default: "" },
    // 🗺️ Koordinat gedung untuk Geo Map
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
}, { timestamps: true });

module.exports = mongoose.model("RegionSiteItem", regionSiteItemSchema);
