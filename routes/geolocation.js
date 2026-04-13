// routes/geolocation.js
const express = require("express");
const router = express.Router();
const Pc = require("../models/Pc");
const Asset = require("../models/Asset");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");

// GET /api/geolocation/map — Data untuk peta interaktif
router.get("/map", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { site, status } = req.query;

        // Filter PC yang punya geolocation
        const pcFilter = {
            "geolocation.lat": { $ne: null },
            "geolocation.lng": { $ne: null }
        };
        if (site) pcFilter.site = site;
        if (status) pcFilter.status = status;

        const pcs = await Pc.find(pcFilter)
            .select("pcId serialNumber status lastActive ipAddress site geolocation userLogin")
            .populate("spec", "hostname")
            .lean();

        // Ambil info Asset terkait (owner, FA Number)
        const serialNumbers = pcs.map(p => p.serialNumber);
        const assets = await Asset.find({ serialNumber: { $in: serialNumbers } })
            .select("serialNumber faNumber ownerFullname productName site")
            .lean();

        const assetMap = {};
        assets.forEach(a => { assetMap[a.serialNumber] = a; });

        // Gabungkan data
        const mapData = pcs.map(pc => {
            const asset = assetMap[pc.serialNumber] || {};
            return {
                _id: pc._id,
                pcId: pc.pcId,
                serialNumber: pc.serialNumber,
                status: pc.status,
                lastActive: pc.lastActive,
                ipAddress: pc.ipAddress,
                site: pc.site || asset.site || "-",
                hostname: pc.spec?.hostname || "-",
                userLogin: pc.userLogin || "-",
                owner: asset.ownerFullname || "-",
                faNumber: asset.faNumber || "-",
                productName: asset.productName || "-",
                lat: pc.geolocation.lat,
                lng: pc.geolocation.lng,
                geoCity: pc.geolocation.city || "-",
                geoSource: pc.geolocation.source || "unknown",
            };
        });

        // Juga kirim daftar site unik untuk filter dropdown
        const sites = await Pc.distinct("site", {
            "geolocation.lat": { $ne: null }
        });

        res.json({ mapData, sites: sites.filter(Boolean) });
    } catch (err) {
        console.error("❌ [GeoMap] Error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
