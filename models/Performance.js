const mongoose = require("mongoose");

const performanceSchema = new mongoose.Schema({
  pc: { type: mongoose.Schema.Types.ObjectId, ref: "Pc" },
  cpuUsage: Number, // dalam persen (misal 45.3)
  ramUsage: Number, // dalam persen

  diskUsage: [
    {
      drive: { type: String }, // C, D, E, dll
      used: { type: Number }, // GB (misal 120)
      total: { type: Number }, // GB (misal 256)
    },
  ],

  uptime: Number,
  agentUptime: Number,
  uptimeTotal: Number,
  idleTime: Number,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Performance", performanceSchema);
