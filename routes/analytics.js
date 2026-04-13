const express = require("express");
const router = express.Router();
const Asset = require("../models/Asset");
const Performance = require("../models/Performance");
const Pc = require("../models/Pc");
const verifyToken = require("../middleware/verifyToken");

// ─── GET /api/analytics/filters ── Distinct values for filters ──
router.get("/filters", verifyToken, async (req, res) => {
    try {
        const [sites, departments, pics, devices] = await Promise.all([
            Asset.distinct("site"),
            Asset.distinct("department"),
            Asset.distinct("ownerFullname"),
            Asset.distinct("faNumber"),
        ]);

        res.json({
            sites: sites.filter(Boolean),
            departments: departments.filter(Boolean),
            pics: pics.filter(Boolean),
            devices: devices.filter(Boolean),
        });
    } catch (err) {
        console.error("❌ Failed to fetch analytics filters:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ─── GET /api/analytics/dashboard ── Aggregated dashboards ──
router.get("/dashboard", verifyToken, async (req, res) => {
    try {
        const { site, department, pic, device } = req.query;

        // 1. Build Asset match filter
        const assetMatch = {};
        
        // Security check: If role is "user", force the site filter
        if (req.user && req.user.role === "user") {
            assetMatch.site = req.user.site;
        } else if (site) {
            assetMatch.site = site;
        }

        if (department) assetMatch.department = department;
        if (pic) assetMatch.ownerFullname = pic;
        if (device) assetMatch.faNumber = device;

        // 2. Find matching Assets to get their PC ObjectIds
        const matchingAssets = await Asset.find(assetMatch).select("pc status").lean();
        const pcIds = matchingAssets.map(a => a.pc).filter(id => id != null);

        // 3. Asset Status stats (Deployed vs others)
        const assetsByStatus = matchingAssets.reduce((acc, curr) => {
            const st = curr.status || "Unknown";
            acc[st] = (acc[st] || 0) + 1;
            return acc;
        }, {});

        // 4. If no PCs associated, return basic asset stats only
        if (pcIds.length === 0) {
            return res.json({
                assetStats: Object.keys(assetsByStatus).map(name => ({ name, value: assetsByStatus[name] })),
                pcStats: [],
                performance: { avgCpu: 0, avgRam: 0, avgDisk: 0 },
            });
        }

        // 5. Build Pc match based on retrieved PC IDs
        const pcMatch = { _id: { $in: pcIds } };

        // 6. Aggregate PC Status
        const pcs = await Pc.find(pcMatch).select("status").lean();
        const pcsByStatus = pcs.reduce((acc, curr) => {
            const st = curr.status || "offline";
            acc[st] = (acc[st] || 0) + 1;
            return acc;
        }, {});

        // 7. Aggregate Performance across those PCs
        // Note: For 'diskUsage', it's usually an array. We can aggregate CPU and RAM from Performance.
        // Or we can rely on `Pc.performance` snapshot directly without querying Performance.
        // Doing the aggregate query on `Pc.performance` is faster if available.
        // Let's query `Performance` table with latest timestamp or aggregate `Performance` table.
        // For simplicity, we can do $avg on `Performance` collection for these PC IDs over the last 1-24 hours.
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const perfAggregation = await Performance.aggregate([
            { $match: { pc: { $in: pcIds }, timestamp: { $gte: oneHourAgo } } },
            {
                $addFields: {
                    totalDiskUsed: { $sum: "$diskUsage.used" },
                    totalDiskSize: { $sum: "$diskUsage.total" }
                }
            },
            {
                $addFields: {
                    avgDiskPercent: {
                        $cond: [
                            { $gt: ["$totalDiskSize", 0] },
                            { $multiply: [ { $divide: ["$totalDiskUsed", "$totalDiskSize"] }, 100 ] },
                            0
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgCpu: { $avg: "$cpuUsage" },
                    avgRam: { $avg: "$ramUsage" },
                    avgDisk: { $avg: "$avgDiskPercent" }
                },
            },
        ]);

        let perfStats = perfAggregation.length > 0 
            ? { avgCpu: perfAggregation[0].avgCpu, avgRam: perfAggregation[0].avgRam, avgDisk: perfAggregation[0].avgDisk } 
            : { avgCpu: 0, avgRam: 0, avgDisk: 0 };

        res.json({
            assetStats: Object.keys(assetsByStatus).map(name => ({ name, value: assetsByStatus[name] })),
            pcStats: Object.keys(pcsByStatus).map(name => ({ name, value: pcsByStatus[name] })),
            performance: perfStats,
        });

    } catch (err) {
        console.error("❌ Failed to fetch analytics dashboard:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
