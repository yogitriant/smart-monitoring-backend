// routes/opname.js
const express = require("express");
const router = express.Router();
const PC = require("../models/Pc");
const Spec = require("../models/Spec");
const OpnameReport = require("../models/OpnameReport");
const verifyToken = require("../middleware/verifyToken");

// ✅ CREATE REPORT
router.post("/create", verifyToken, async (req, res) => {
  try {
    const { reportName, filter } = req.body;

    const pcs = await PC.find(filter).populate("location");
    const specs = await Spec.find({ pc: { $in: pcs.map((pc) => pc._id) } });

    const items = pcs.map((pc) => {
      const spec = specs.find((s) => s.pc.toString() === pc._id.toString());
      const storage =
        spec?.disk
          ?.map((d) => `${d.drive}: ${d.total} (${d.type})`)
          .join(", ") || "-";

      return {
        pcId: pc._id.toString(),
        serialNumber: pc.serialNumber,
        assetNumber: pc.assetNumber,
        location: `${pc.location?.campus || "-"} - ${pc.location?.room || "-"}`,
        ram: spec?.ram || "-",
        storage,
        status: "hadir",
        kondisi: "",
        keterangan: "",
      };
    });

    const report = await OpnameReport.create({
      reportName,
      createdBy: req.user?.username || "unknown",
      items,
    });

    res.json({ message: "✅ Report created", report });
  } catch (err) {
    console.error("❌ Gagal create report:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
