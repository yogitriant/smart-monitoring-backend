const mongoose = require("mongoose");

const performanceSchema = new mongoose.Schema({
  pc: { type: mongoose.Schema.Types.ObjectId, ref: "Pc" },
  cpuUsage: Number,
  ramUsage: Number,
  diskUsage: [
    {
      drive: { type: String },
      used: { type: Number },
      total: { type: Number },
    },
  ],
  diskHealth: [
    {
      name: String,
      type: { type: String },
      smartStatus: String
    }
  ],
  battery: {
    percent: Number,
    isCharging: Boolean,
    health: Number
  },
  activeIp: String,

  uptime: Number,
  agentUptime: Number,
  uptimeTotal: Number,

  // 🔹 Idle
  idleRaw: Number,  // nilai mentah dari agent (misal 350 detik)
  idleTime: Number, // idle setelah lewat threshold (misal 50 detik kalau threshold 300)

  timestamp: { type: Date, default: Date.now },
});


module.exports = mongoose.model("Performance", performanceSchema);
