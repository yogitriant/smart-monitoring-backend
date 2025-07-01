const mongoose = require("mongoose");

const pcHistorySchema = new mongoose.Schema(
  {
    pcId: { type: String, required: true },
    oldData: { type: Object, required: true },
    newData: { type: Object }, // ✅ Tambahkan ini
    action: { type: String, enum: ["edit", "delete"], required: true },
    adminName: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PcHistory", pcHistorySchema);
