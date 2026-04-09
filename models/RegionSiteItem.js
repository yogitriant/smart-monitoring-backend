const mongoose = require("mongoose");

const regionSiteItemSchema = new mongoose.Schema({
    region: { type: String, default: "" },
    siteGroup: { type: String, default: "" },
    site: { type: String, default: "" },
    division: { type: String, default: "" },
    department: { type: String, default: "" },
    ownerSite: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("RegionSiteItem", regionSiteItemSchema);
