// services/specProcessor.js
// Logika pemrosesan spec yang bisa dipanggil langsung (tanpa HTTP)
// Diekstrak dari routes/spec.js agar bisa dipakai oleh socket handler

const mongoose = require("mongoose");
const Spec = require("../models/Spec");
const SpecHistory = require("../models/SpecHistory");
const Pc = require("../models/Pc");
const Asset = require("../models/Asset");

/* ===========================
   Konfigurasi & Helpers
=========================== */
const DISK_DELTA_GB_THRESHOLD = 100;

const minorFields = ["hostname", "ipAddress", "macAddress", "brand", "model"];
const majorFields = ["os", "cpu", "ram", "gpu", "disk"];

const parseGbNumber = (v) => {
  if (v == null) return null;
  if (typeof v === "number") return Math.round(v);
  const m = String(v).match(/([\d.]+)/);
  return m ? Math.round(Number(m[1])) : null;
};

const bytesToGB = (bytes) =>
  bytes == null ? null : Math.round(bytes / 1024 / 1024 / 1024);

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

function diskChanged(prev = [], curr = [], thresholdGB = DISK_DELTA_GB_THRESHOLD) {
  const a = normalizeDisks(prev);
  const b = normalizeDisks(curr);
  const drives = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const drv of drives) {
    const pa = a[drv]?.totalGB ?? null;
    const cb = b[drv]?.totalGB ?? null;
    if (pa == null || cb == null) continue;
    if (Math.abs(cb - pa) >= thresholdGB) return true;
  }
  return false;
}

function eqShallowFields(prev = {}, curr = {}, fields = []) {
  for (const f of fields) {
    if (f === "disk") continue;
    if ((prev?.[f] ?? null) !== (curr?.[f] ?? null)) return false;
  }
  return true;
}

function formatDiskStorage(disks) {
  if (!Array.isArray(disks) || disks.length === 0) return null;
  const formatted = disks.map(d => {
    let sizeGB = d.totalGB || Math.round((d.totalBytes || d.total) / (1024 * 1024 * 1024)) || 0;
    let sizeStr = "";
    if (sizeGB >= 900 && sizeGB <= 1050) sizeStr = "1 TB";
    else if (sizeGB >= 1800 && sizeGB <= 2100) sizeStr = "2 TB";
    else if (sizeGB >= 3600 && sizeGB <= 4200) sizeStr = "4 TB";
    else if (sizeGB > 450 && sizeGB <= 512) sizeStr = "512 GB";
    else if (sizeGB > 220 && sizeGB <= 256) sizeStr = "256 GB";
    else if (sizeGB > 110 && sizeGB <= 128) sizeStr = "128 GB";
    else if (sizeGB >= 1000) sizeStr = `${(sizeGB / 1000).toFixed(1)} TB`;
    else sizeStr = `${sizeGB} GB`;
    
    const typeStr = d.type ? d.type.toUpperCase() : "Disk";
    return `${sizeStr} ${typeStr}`;
  });
  return formatted.join(" + ");
}

function sanitizeIncomingSpec(s) {
  const { bios, ...rest } = s || {};
  return rest;
}

/**
 * Update linked Asset record with latest spec data
 */
async function updateLinkedAsset(pcObjectId, specData) {
  try {
    const asset = await Asset.findOne({ pc: pcObjectId });
    if (!asset) return;

    // Update brand & model directly
    if (specData.brand && specData.brand !== "-") asset.brand = specData.brand;
    if (specData.model && specData.model !== "-") asset.model = specData.model;

    // Update customSpecs with latest hardware info
    const specKeys = ["CPU", "RAM", "GPU", "OS", "Storage"];
    const specMap = {
      CPU: specData.cpu,
      RAM: specData.ram,
      GPU: specData.gpu,
      OS: specData.os,
      Storage: formatDiskStorage(specData.disk),
    };

    // Preserve existing non-spec customSpecs
    const existingSpecs = (asset.customSpecs || []).filter(
      (s) => !specKeys.includes(s.key)
    );

    // Add updated spec values
    const newSpecs = [...existingSpecs];
    for (const [key, value] of Object.entries(specMap)) {
      if (value && value !== "-") {
        newSpecs.push({ key, value });
      }
    }

    asset.customSpecs = newSpecs;
    await asset.save();
  } catch (err) {
    console.warn("⚠️ Gagal update linked Asset:", err.message);
  }
}

/* ===========================
   Main: processSpec(data)
   Mengembalikan { status, message }
=========================== */
async function processSpec(data) {
  const { pcId, ...rawSpec } = data;

  if (!mongoose.isValidObjectId(pcId)) {
    return { status: 400, message: "Invalid pcId" };
  }

  const pc = await Pc.findById(pcId);
  if (!pc) return { status: 404, message: "PC not found" };

  const pcObjectId = pc._id;
  const newSpec = sanitizeIncomingSpec(rawSpec);

  const normalizedNew = {
    hostname: newSpec.hostname ?? "-",
    brand: newSpec.brand ?? "-",
    model: newSpec.model ?? "-",
    cpu: newSpec.cpu ?? "-",
    ram: newSpec.ram ?? "-",
    os: newSpec.os ?? "-",
    gpu: newSpec.gpu ?? "-",
    ipAddress: newSpec.ipAddress ?? "-",
    macAddress: newSpec.macAddress ?? "-",
    resolution: newSpec.resolution ?? "-",
    disk: Array.isArray(newSpec.disk) ? newSpec.disk : [],
  };

  let oldSpec = await Spec.findOne({ pc: pcObjectId });

  // FIRST-TIME SAVE
  if (!oldSpec) {
    const spec = await Spec.create({
      pc: pcObjectId,
      ...normalizedNew,
      approved: true,
    });
    pc.spec = spec._id;
    await pc.save();
    await updateLinkedAsset(pcObjectId, normalizedNew);
    return { status: 200, message: "Spec saved (first time)" };
  }

  // MINOR FIELDS
  let hasMinorUpdate = false;
  for (const field of minorFields) {
    if ((oldSpec[field] ?? null) !== (normalizedNew[field] ?? null)) {
      oldSpec[field] = normalizedNew[field];
      hasMinorUpdate = true;
    }
  }

  // LAKUKAN PENYIMPANAN MINOR SEGERA, JANGAN DITUNDA KARENA MAJOR UPDATE
  if (hasMinorUpdate) {
    await oldSpec.save();
    await updateLinkedAsset(pcObjectId, normalizedNew);
  }

  // MAJOR FIELDS
  const simpleMajorChanged = !eqShallowFields(oldSpec, normalizedNew, majorFields);
  const diskMajorChanged = diskChanged(oldSpec.disk, normalizedNew.disk);
  const hasMajorUpdate = simpleMajorChanged || diskMajorChanged;

  if (hasMajorUpdate) {
    // Mencegah duplikasi: Cari apakah sudah ada spec history yang statusnya pending untuk PC ini
    const existingPending = await SpecHistory.findOne({
      pc: pcObjectId,
      approved: false,
      rejected: false,
    });

    if (existingPending) {
      // Jika sudah ada yg pending, verifikasi apakah persis sama dengan payload yang baru dikirim agent
      const simplePendingChanged = !eqShallowFields(existingPending.newSpec, normalizedNew, majorFields);
      const diskPendingChanged = diskChanged(existingPending.newSpec?.disk, normalizedNew.disk);
      const isDifferentFromPending = simplePendingChanged || diskPendingChanged;

      if (!isDifferentFromPending) {
        // Spec sama persis dengan yang sedang di-pending, ABAIKAN (jangan buat duplikat)
        return { status: 200, message: "Spec change already pending approval" };
      } else {
        // Agent melaporkan spec berbeda lagi selagi yang lama belum diapprove, UPDATE yang pending
        existingPending.newSpec = normalizedNew;
        await existingPending.save();
        return { status: 200, message: "Pending spec change updated with latest data" };
      }
    } else {
      // Belum ada yang pending, BUAT BARU
      await SpecHistory.create({
        pc: pcObjectId,
        oldSpec: oldSpec.toObject(),
        newSpec: normalizedNew,
      });
      return { status: 200, message: "Spec change detected, pending approval" };
    }
  }

  if (hasMinorUpdate) {
    return { status: 200, message: "Minor spec updated successfully" };
  }

  return { status: 200, message: "No spec changes" };
}

module.exports = { processSpec, formatDiskStorage };
