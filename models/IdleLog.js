const mongoose = require("mongoose");

const idleLogSchema = new mongoose.Schema({
  pc: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Pc",
    required: true,
  },
  idleRaw: {
    type: Number,
    default: 0, // waktu idle dalam detik
  },
  status: {
    type: String,
    enum: ["online", "idle"],
    default: "online",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// 🔹 Index untuk mempercepat query per PC
idleLogSchema.index({ pc: 1, timestamp: -1 });

module.exports = mongoose.model("IdleLog", idleLogSchema);
