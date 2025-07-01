const express = require("express");
const router = express.Router();
const Pc = require("../models/Pc");
const Location = require("../models/Location");
const { generatePcId } = require("../utils/generatePcId");

// Helper: Normalisasi string kosong jadi "-"
const safeString = (val) =>
  typeof val === "string" && val.trim().length > 0 ? val.trim() : "-";

// POST /api/pc/register
router.post("/register", async (req, res) => {
  const {
    serialNumber,
    assetNumber,
    pic,
    userLogin,
    isAdmin,
    location, // optional
    type, // optional: "DT", "LT", etc.
  } = req.body;

  try {
    // 1️⃣ Validasi serialNumber
    if (!serialNumber || serialNumber === "UNKNOWN") {
      return res.status(400).json({ message: "Serial number wajib diisi" });
    }

    // 2️⃣ Cek apakah PC sudah terdaftar
    let pc = await Pc.findOne({ serialNumber });

    if (pc) {
      console.log("✅ PC sudah terdaftar:", pc.pcId);
      return res.json({
        message: "✅ PC already registered",
        pcId: pc._id,
        isAdmin: pc.isAdmin,
        type: pc.pcId.startsWith("LT") ? "LT" : "DT",
        userLogin: pc.userLogin,
        assetNumber: pc.assetNumber,
        idleTimeout: pc.idleTimeout,
        shutdownDelay: pc.shutdownDelay,
      });
    }

    // 3️⃣ Lokasi fallback jika tidak dikirim
    const fallbackLocation = {
      category: "Unassigned",
      room: "Unknown",
      floor: "Unknown",
      campus: "Unknown",
    };
    const locationData = location || fallbackLocation;

    let loc = await Location.findOne(locationData);
    if (!loc) {
      loc = new Location(locationData);
      await loc.save();
    }

    // 4️⃣ Generate PC ID
    const deviceType = type || "DT";
    const pcId = await generatePcId(deviceType);

    console.log("🛬 Data diterima backend:", req.body);
    console.log("📌 Menyimpan PC baru dengan ID:", pcId);

    // 5️⃣ Simpan ke database
    pc = new Pc({
      pcId,
      serialNumber,
      assetNumber: safeString(assetNumber),
      pic: safeString(pic),
      userLogin: safeString(userLogin),
      isAdmin,
      type: deviceType,
      location: loc._id,
      idleTimeout: 0,
      shutdownDelay: 1,
      agentVersion: "1.0.0", // optional: simpan default versi agent
    });

    await pc.save();

    // 6️⃣ Kirim response
    res.json({
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
    console.error("❌ Error in register:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
