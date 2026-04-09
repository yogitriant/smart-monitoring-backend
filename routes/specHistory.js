// routes/specHistory.js
const express = require("express");
const router = express.Router();
const Spec = require("../models/Spec");
const SpecHistory = require("../models/SpecHistory");
const Asset = require("../models/Asset");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");

/* ===========================
   Konfigurasi & Helpers
=========================== */
const DISK_DELTA_GB_THRESHOLD = 100;
const { formatDiskStorage } = require("../services/specProcessor");

// parse "238 GB" | 238 | "238.4" → 238 (GB)
const parseGbNumber = (v) => {
  if (v == null) return null;
  if (typeof v === "number") return Math.round(v);
  const m = String(v).match(/([\d.]+)/);
  return m ? Math.round(Number(m[1])) : null;
};
const bytesToGB = (bytes) =>
  bytes == null ? null : Math.round(bytes / 1024 / 1024 / 1024);

// Normalisasi array disk → map by drive letter { C:{drive,type,totalGB}, ... }
function normalizeDisks(disks = []) {
  const map = {};
  for (const d of disks) {
    const drive = String(d.drive || "").toUpperCase();
    if (!drive) continue;
    const type = d.type || "SSD";
    const totalGB =
      parseGbNumber(d.totalGB) ??
      (d.totalBytes != null ? bytesToGB(d.totalBytes) : null) ??
      parseGbNumber(d.total);
    map[drive] = { drive, type, totalGB };
  }
  return map;
}

// Apakah perubahan DISK signifikan (≥ threshold per drive)?
function isDiskDeltaSignificant(
  oldDisk = [],
  newDisk = [],
  threshold = DISK_DELTA_GB_THRESHOLD
) {
  const a = normalizeDisks(oldDisk);
  const b = normalizeDisks(newDisk);
  const drives = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const drv of drives) {
    const pa = a[drv]?.totalGB ?? null;
    const cb = b[drv]?.totalGB ?? null;
    if (pa == null || cb == null) continue; // kalau incomplete, abaikan
    if (Math.abs(cb - pa) >= threshold) return true;
  }
  return false;
}

// Buang BIOS dari objek spec
function withoutBios(spec = {}) {
  if (!spec || typeof spec !== "object") return spec;
  const { bios, ...rest } = spec;
  return rest;
}

// 🔧 Normalisasi PIC → simpan detail penting
function normalizePic(pic) {
  if (!pic) return null;
  if (typeof pic !== "object") return { name: pic };

  return {
    name: pic.name || "-",
    email: pic.email || "-",
    department: pic.department || "-",
    phone: pic.phone || "-",
  };
}

// Apakah riwayat ini signifikan setelah men-skip BIOS?
function isSignificantHistory(h) {
  if (!h) return false;
  const oldSpec = withoutBios(h.oldSpec || {});
  const newSpec = withoutBios(h.newSpec || {});

  // Bandingkan field sederhana (kecuali disk yang punya aturan khusus)
  const simpleFields = [
    "os",
    "cpu",
    "ram",
    "gpu",
    "brand",
    "model",
    "ipAddress",
    "macAddress",
    "resolution",
    "pic", // ikut cek PIC
  ];
  for (const f of simpleFields) {
    if ((oldSpec?.[f] ?? null) !== (newSpec?.[f] ?? null)) return true;
  }

  // Khusus disk
  if (isDiskDeltaSignificant(oldSpec.disk, newSpec.disk)) return true;

  // Kalau hanya BIOS atau disk delta kecil → tidak signifikan
  return false;
}

/* ===========================
   GET: daftar riwayat (filtered)
=========================== */
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const raw = await SpecHistory.find()
      .populate({ path: "pc", populate: { path: "pic" } })
      .sort({ createdAt: -1 })
      .lean();

    // 1) filter agar hanya riwayat signifikan
    const filtered = raw.filter(isSignificantHistory);

    // 2) hapus field BIOS + normalisasi PIC jadi detail
    const sanitized = filtered.map((h) => ({
      ...h,
      oldSpec: {
        ...withoutBios(h.oldSpec),
        pic: normalizePic(h.oldSpec?.pic),
      },
      newSpec: {
        ...withoutBios(h.newSpec),
        pic: normalizePic(h.newSpec?.pic),
      },
    }));

    res.json(sanitized);
  } catch (err) {
    console.error("❌ Failed to get spec history:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   APPROVE
=========================== */
router.put("/:id/approve", verifyToken, verifyAdmin, async (req, res) => {
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

    // Simpan spec baru TANPA BIOS
    const newSanitized = withoutBios(history.newSpec || {});
    spec.set({ ...newSanitized, approved: true });
    await spec.save();

    history.approved = true;
    history.reviewedAt = new Date();
    history.approvedBy = req.body.adminName || "admin";
    await history.save();

    res.json({ message: "Spec approved and updated" });

    // Sync to Asset (non-blocking)
    try {
      const asset = await Asset.findOne({ pc: history.pc });
      if (asset) {
        const s = withoutBios(history.newSpec || {});
        if (s.brand && s.brand !== "-") asset.brand = s.brand;
        if (s.model && s.model !== "-") asset.model = s.model;

        const specKeys = ["CPU", "RAM", "GPU", "OS", "Storage"];
        const specMap = { CPU: s.cpu, RAM: s.ram, GPU: s.gpu, OS: s.os, Storage: formatDiskStorage(s.disk) };
        const keep = (asset.customSpecs || []).filter(cs => !specKeys.includes(cs.key));
        for (const [key, value] of Object.entries(specMap)) {
          if (value && value !== "-") keep.push({ key, value });
        }
        asset.customSpecs = keep;
        await asset.save();
        console.log("📦 Asset synced after spec approve");
      }
    } catch (syncErr) {
      console.warn("⚠️ Asset sync after approve failed:", syncErr.message);
    }
  } catch (err) {
    console.error("❌ Approve failed:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   REJECT
=========================== */
router.put("/:id/reject", verifyToken, verifyAdmin, async (req, res) => {
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
