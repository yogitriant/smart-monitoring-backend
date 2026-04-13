const mongoose = require("mongoose");

const pcSchema = new mongoose.Schema(
  {
    pcId: { type: String, unique: true, required: true },
    email: String,
    serialNumber: { type: String, required: true, unique: true },

    // Identitas pengguna & aset
    assetNumber: String,
    pic: { type: mongoose.Schema.Types.ObjectId, ref: "Pic" },
    userLogin: String,
    lastLoginUser: String,
    isAdmin: { type: Boolean, default: false },
    agentVersion: { type: String, default: null },

    // Lokasi relasional
    location: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
    site: { type: String, default: "" }, // Ditambahkan sebagai ganti Location.campus
    type: String,

    // Dinamis
    ipAddress: String,
    status: {
      type: String,
      enum: ["online", "idle", "offline"],
      default: "offline",
    },
    lastActive: Date,

    // Agent settings
    idleTimeout: { type: Number, default: 0 },
    shutdownDelay: { type: Number, default: 0 },
    performanceInterval: { type: Number, default: 3600 },

    // Snapshot performance terbaru
    performance: {
      cpuUsage: Number,
      ramUsage: Number,
      diskUsage: [
        { drive: String, used: Number, total: Number }
      ],
      idleRaw: Number,   // dari agent, mentah
      idleTime: Number,  // hasil setelah threshold
      battery: {
        percent: Number,
        isCharging: Boolean,
        health: Number
      },
      diskHealth: [
        { name: String, type: { type: String }, smartStatus: String }
      ]
    },

    // Hubungan ke spesifikasi
    spec: { type: mongoose.Schema.Types.ObjectId, ref: "Spec" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Pc", pcSchema);
