const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Spec = require("../models/Spec");
const SpecHistory = require("../models/SpecHistory");
const Pc = require("../models/Pc");

const minorFields = ["ipAddress", "macAddress", "brand", "model", "resolution"];
const majorFields = ["os", "cpu", "ram", "gpu", "disk"];

function isDifferent(oldVal, newVal) {
  return JSON.stringify(oldVal) !== JSON.stringify(newVal);
}

router.post("/", async (req, res) => {
  const { pcId, ...newSpec } = req.body;

  try {
    console.log("📩 Received spec for pcId:", pcId);

    if (!mongoose.isValidObjectId(pcId)) {
      return res.status(400).json({ message: "Invalid pcId" });
    }

    const pc = await Pc.findById(pcId);
    if (!pc) return res.status(404).json({ message: "PC not found" });

    const pcObjectId = pc._id;

    const oldSpec = await Spec.findOne({ pc: pcObjectId });

    if (!oldSpec) {
      const spec = await Spec.create({
        pc: pcObjectId,
        ...newSpec,
        approved: true,
      });

      // Optional: jika ingin populate spec dari PC
      pc.spec = spec._id;
      await pc.save();

      return res.json({ message: "✅ Spec saved (first time)" });
    }

    // 🔎 Cek perubahan minor
    let hasMinorUpdate = false;
    for (const field of minorFields) {
      if (isDifferent(oldSpec[field], newSpec[field])) {
        oldSpec[field] = newSpec[field];
        hasMinorUpdate = true;
      }
    }

    // 🔎 Cek perubahan mayor
    const hasMajorUpdate = majorFields.some((field) =>
      isDifferent(oldSpec[field], newSpec[field])
    );

    // 📝 Jika ada perubahan mayor → pending approval
    if (hasMajorUpdate) {
      await SpecHistory.create({
        pc: pcObjectId,
        oldSpec: oldSpec.toObject(),
        newSpec,
      });
      return res.json({ message: "🕓 Spec change detected, pending approval" });
    }

    // 🔁 Jika hanya perubahan minor → update langsung
    if (hasMinorUpdate) {
      await oldSpec.save();
      return res.json({ message: "🔄 Minor spec updated successfully" });
    }

    res.json({ message: "🟰 No spec changes" });
  } catch (err) {
    console.error("❌ Error saving spec:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
