const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Pc = require("../models/Pc");
const Asset = require("../models/Asset");
const Location = require("../models/Location");
const { generatePcId } = require("../utils/generatePcId");

// String kosong -> fallback
const safeString = (val, fallback = "-") =>
  typeof val === "string" && val.trim().length > 0 ? val.trim() : fallback;

// Hanya kembalikan ObjectId valid; selain itu abaikan (undefined)
const normalizePic = (val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "string" && val.trim() === "-") return undefined;
  if (val instanceof mongoose.Types.ObjectId) return val;
  if (typeof val === "string" && mongoose.isValidObjectId(val.trim())) {
    return new mongoose.Types.ObjectId(val.trim());
  }
  return undefined;
};

// POST /api/pc/register
router.post("/register", async (req, res) => {
  try {
    const {
      serialNumber,
      assetNumber,
      pic,
      userLogin,
      isAdmin,
      location,
      type,
      agentVersion,
      cpu,
      ram,
      os: osInfo,
      storage,
    } = req.body;

    if (!serialNumber || serialNumber === "UNKNOWN") {
      return res.status(400).json({ message: "Serial number wajib diisi" });
    }

    // Sudah terdaftar?
    let pc = await Pc.findOne({ serialNumber });
    if (pc) {
      console.log("✅ PC sudah terdaftar:", pc.pcId);
      return res.json({
        message: "✅ PC already registered",
        pcId: pc._id,
        isAdmin: pc.isAdmin,
        type: pc.type || (pc.pcId?.startsWith("LT") ? "LT" : "DT"),
        userLogin: pc.userLogin,
        assetNumber: pc.assetNumber,
        idleTimeout: pc.idleTimeout,
        shutdownDelay: pc.shutdownDelay,
      });
    }

    // Lokasi fallback
    const fallbackLocation = {
      category: "Unassigned",
      room: "Unknown",
      floor: "Unknown",
      campus: "Unknown",
    };
    const locData = location || fallbackLocation;

    let loc = await Location.findOne(locData);
    if (!loc) loc = await Location.create(locData);

    // Buat pcId baru
    const deviceType = type || "DT";
    const pcId = await generatePcId(deviceType);

    console.log("🛬 Data diterima backend:", req.body);
    console.log("📌 Menyimpan PC baru dengan ID:", pcId);

    // Susun dokumen
    const doc = {
      pcId,
      serialNumber,
      assetNumber: safeString(assetNumber),
      userLogin: safeString(userLogin),
      isAdmin: Boolean(isAdmin),
      type: deviceType,
      location: loc._id,
      idleTimeout: 0,
      shutdownDelay: 60,
      agentVersion: agentVersion || "1.0.0",
    };

    const picId = normalizePic(pic);
    if (picId) doc.pic = picId; // hanya set jika valid

    pc = await Pc.create(doc);

    // ─── Auto-create Asset record ───────────────────────
    try {
      const subCat = deviceType === "LT" ? "Laptop" : "Desktop";

      // Resolve PIC name if available
      let ownerName = "";
      if (pc.pic) {
        const Pic = require("../models/PicTemp");
        const picDoc = await Pic.findById(pc.pic);
        if (picDoc) ownerName = picDoc.name || "";
      }

      // Resolve location site
      let siteName = "";
      if (loc) siteName = loc.campus || "";

      await Asset.create({
        faNumber: safeString(assetNumber, "") || undefined, // assetNumber = faNumber
        serialNumber,
        productCategory: "Hardware",
        subCategory: subCat,
        status: "Deployed",
        site: siteName,
        ownerFullname: ownerName,
        customSpecs: [
          ...(cpu ? [{ key: "CPU", value: cpu }] : []),
          ...(ram ? [{ key: "RAM", value: ram }] : []),
          ...(osInfo ? [{ key: "OS", value: osInfo }] : []),
          ...(storage ? [{ key: "Storage", value: storage }] : []),
        ],
        pc: pc._id,
      });
      console.log("📦 Asset auto-created for PC:", pc.pcId);
    } catch (assetErr) {
      // Jangan block registrasi PC jika gagal buat asset
      console.warn("⚠️ Gagal auto-create asset:", assetErr.message);
    }

    return res.json({
      message: "🆕 PC registered successfully",
      pcId: pc._id,
      isAdmin: pc.isAdmin,
      type: deviceType,
      userLogin: pc.userLogin,
      assetNumber: pc.assetNumber,
      idleTimeout: pc.idleTimeout,
      shutdownDelay: pc.shutdownDelay,
    });
  } catch (err) {
    console.error("❌ Error in register:", err);
    if (err?.name === "CastError") {
      return res.status(400).json({ message: `Invalid field type: ${err.path}` });
    }
    return res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/pc/:id  (hanya update userLogin)
router.put("/:id", async (req, res) => {
  try {
    const { userLogin } = req.body;
    const pc = await Pc.findById(req.params.id);
    if (!pc) return res.status(404).json({ message: "PC not found" });

    if (typeof userLogin === "string" && userLogin.trim() && userLogin !== pc.userLogin) {
      pc.userLogin = safeString(userLogin);
      await pc.save();
      console.log(`🔄 Updated userLogin: ${userLogin}`);
    }

    res.json({ message: "Updated", userLogin: pc.userLogin });
  } catch (err) {
    console.error("❌ Error in PUT /pc/:id:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
