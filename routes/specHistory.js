const express = require("express");
const router = express.Router();
const Spec = require("../models/Spec");
const SpecHistory = require("../models/SpecHistory");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");

// 🔍 GET all spec histories
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  // console.log("🔍 GET /spec-history oleh:", req.user?.username, req.user?.role);
  try {
    const history = await SpecHistory.find()
      .populate("pc")
      .sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    console.error("❌ Failed to get spec history:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ APPROVE: PUT /api/spec-history/:id/approve
router.put("/:id/approve", async (req, res) => {
  try {
    const history = await SpecHistory.findById(req.params.id);
    if (!history || history.approved || history.rejected) {
      return res
        .status(404)
        .json({ message: "Spec history not found or already reviewed" });
    }

    const spec = await Spec.findOne({ pc: history.pc });
    if (!spec) {
      return res.status(404).json({ message: "Spec not found" });
    }
    spec.set({ ...history.newSpec, approved: true });
    await spec.save();

    history.approved = true;
    history.reviewedAt = new Date();
    history.approvedBy = req.body.adminName || "admin";
    await history.save();

    res.json({ message: "Spec approved and updated" });
  } catch (err) {
    console.error("❌ Approve failed:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ❌ REJECT: PUT /api/spec-history/:id/reject
router.put("/:id/reject", async (req, res) => {
  try {
    const history = await SpecHistory.findById(req.params.id);
    if (!history || history.approved || history.rejected) {
      return res
        .status(404)
        .json({ message: "Spec history not found or already reviewed" });
    }

    history.rejected = true;
    history.reviewedAt = new Date();
    history.approvedBy = req.body.adminName || "admin";
    await history.save();

    res.json({ message: "Spec change rejected" });
  } catch (err) {
    console.error("❌ Reject failed:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
