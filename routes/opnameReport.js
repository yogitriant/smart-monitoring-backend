// routes/opnameReport.js
const express = require("express");
const router = express.Router();
const Pc = require("../models/Pc");
const Spec = require("../models/Spec");
const OpnameReport = require("../models/OpnameReport");
const verifyToken = require("../middleware/verifyToken");
const mongoose = require("mongoose");

// ✅ GET semua laporan
router.get("/", verifyToken, async (req, res) => {
  console.log("✅ Masuk route GET /api/opname");
  try {
    const reports = await OpnameReport.find();
    console.log("✅ Reports ditemukan:", reports.length);
    res.json(reports);
  } catch (err) {
    console.error("❌ Gagal ambil report opname:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
});

// ✅ GET laporan berdasarkan publicToken (akses teknisi)
router.get("/public/:token", async (req, res) => {
  try {
    const report = await OpnameReport.findOne({
      publicToken: req.params.token,
    });
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 📄 Get single report by token or ID
router.get("/:id", async (req, res) => {
  try {
    const report = await OpnameReport.findOne({
      $or: [{ _id: req.params.id }, { publicToken: req.params.id }],
    });

    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ CREATE new report
router.post("/", verifyToken, async (req, res) => {
  try {
    const { reportName, pcIds } = req.body;

    const pcs = await Pc.find({ _id: { $in: pcIds } }).populate("location");
    const specs = await Spec.find({ pc: { $in: pcIds } });

    const items = pcs.map((pc) => {
      const spec = specs.find((s) => s.pc.toString() === pc._id.toString());
      const ram = spec?.ram || "-";

      const storage = Array.isArray(spec?.disk)
        ? spec.disk.map((d) => `${d.total} ${d.type}`).join(", ")
        : "-";

      return {
        pcObjectId: pc._id.toString(), // ✅ untuk update via PUT
        pcId: pc.pcId, // ✅ tampilkan ke user
        serialNumber: pc.serialNumber,
        assetNumber: pc.assetNumber,
        location: `${pc.location?.campus || "-"} - ${pc.location?.room || "-"}`,
        ram,
        storage,
        pic: pc.pic || "-",
        status: "-",
        kondisi: "-",
        keterangan: "-",
      };
    });

    const report = await OpnameReport.create({
      reportName,
      createdBy: req.user.username,
      items,
    });

    res.json({ message: "✅ Report created", report });
  } catch (err) {
    console.error("❌ Gagal buat report:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ UPDATE item hasil opname
router.put("/:reportId/items/:pcId", async (req, res) => {
  const { status, kondisi, keterangan, updatedBy } = req.body;

  try {
    const report = await OpnameReport.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });

    // Gunakan ObjectId untuk pencocokan
    const targetPcId = req.params.pcId;
    const item = report.items.find(
      (i) => i.pcObjectId?.toString() === targetPcId
    );

    if (!item)
      return res.status(404).json({ message: "PC item not found in report" });

    item.status = status;
    item.kondisi = kondisi;
    item.keterangan = keterangan;
    item.updatedBy = updatedBy || "-";
    item.updatedAt = new Date();

    await report.save();
    res.json({ message: "✅ Item updated", item });
  } catch (err) {
    console.error("❌ Gagal update item opname:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ PATCH laporan (edit nama dan daftar PC)
router.patch("/:id", verifyToken, async (req, res) => {
  const { reportName, pcIds } = req.body;
  try {
    // 1. Ambil laporan lama untuk membandingkan data teknisi
    const existingReport = await OpnameReport.findById(req.params.id);
    if (!existingReport) {
      return res.status(404).json({ message: "Report not found" });
    }

    // 2. Ambil data PC dan Spec terbaru
    const pcs = await Pc.find({ _id: { $in: pcIds } }).populate("location");
    const specs = await Spec.find({ pc: { $in: pcIds } });

    // 3. Susun ulang items dengan mempertahankan data teknisi lama (jika ada)
    const items = pcs.map((pc) => {
      const spec = specs.find((s) => s.pc.toString() === pc._id.toString());
      const previous = existingReport.items.find((i) => i.pcId === pc.pcId);

      return {
        pcObjectId: pc._id.toString(),
        pic: pc.pic || "-",
        pcId: pc.pcId,
        serialNumber: pc.serialNumber,
        assetNumber: pc.assetNumber,
        location: `${pc.location?.campus || "-"} - ${pc.location?.room || "-"}`,
        ram: spec?.ram || "-",
        storage: Array.isArray(spec?.disk)
          ? spec.disk.map((d) => `${d.total} ${d.type}`).join(", ")
          : "-",

        // Preserve status teknisi jika sudah ada
        status: previous?.status || "-",
        kondisi: previous?.kondisi || "-",
        keterangan: previous?.keterangan || "-",
        updatedBy: previous?.updatedBy || "-",
        updatedAt: previous?.updatedAt || null,
      };
    });

    // 4. Simpan perubahan
    const report = await OpnameReport.findByIdAndUpdate(
      req.params.id,
      { reportName, items },
      { new: true }
    );

    res.json({ message: "✅ Laporan diperbarui", report });
  } catch (err) {
    console.error("❌ PATCH error:", err.message);
    console.error(err.stack);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
});

// ✅ DELETE laporan
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    await OpnameReport.findByIdAndDelete(req.params.id);
    res.json({ message: "✅ Laporan dihapus" });
  } catch (err) {
    res.status(500).json({ message: "Server error", detail: err.message });
  }
});

module.exports = router;
