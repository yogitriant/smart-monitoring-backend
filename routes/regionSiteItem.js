const express = require("express");
const router = express.Router();
const RegionSiteItem = require("../models/RegionSiteItem");
const verifyToken = require("../middleware/verifyToken");

router.use(verifyToken);

// GET all
router.get("/", async (req, res) => {
    try {
        const items = await RegionSiteItem.find().sort({ region: 1, siteGroup: 1 });
        res.json(items);
    } catch (err) {
        console.error("❌ Gagal ambil region site items:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// POST create
router.post("/", async (req, res) => {
    try {
        const item = await RegionSiteItem.create(req.body);
        res.status(201).json(item);
    } catch (err) {
        console.error("❌ Gagal buat region site item:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// PUT update
router.put("/:id", async (req, res) => {
    try {
        const item = await RegionSiteItem.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!item) return res.status(404).json({ message: "Not found" });
        res.json(item);
    } catch (err) {
        console.error("❌ Gagal update region site item:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// DELETE
router.delete("/:id", async (req, res) => {
    try {
        const item = await RegionSiteItem.findByIdAndDelete(req.params.id);
        if (!item) return res.status(404).json({ message: "Not found" });
        res.json({ message: "Deleted" });
    } catch (err) {
        console.error("❌ Gagal hapus region site item:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
