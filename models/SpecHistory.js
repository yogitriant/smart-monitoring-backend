const mongoose = require("mongoose");

const specHistorySchema = new mongoose.Schema(
  {
    pc: { type: mongoose.Schema.Types.ObjectId, ref: "Pc" },
    oldSpec: Object,
    newSpec: Object,
    approved: { type: Boolean, default: false },
    rejected: { type: Boolean, default: false },
    approvedBy: String,
    reviewedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("SpecHistory", specHistorySchema);
