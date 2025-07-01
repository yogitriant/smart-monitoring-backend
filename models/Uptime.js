const mongoose = require("mongoose");

const uptimeSchema = new mongoose.Schema(
  {
    pc: { type: mongoose.Schema.Types.ObjectId, ref: "PC", required: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    uptimeSession: Number,
    uptimeTotalToday: Number, // ⬅️ ubah di sini
  },
  { timestamps: true }
);

uptimeSchema.index({ pc: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Uptime", uptimeSchema);
