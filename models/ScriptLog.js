const mongoose = require("mongoose");

const ScriptLogSchema = new mongoose.Schema(
  {
    scriptId: { type: mongoose.Schema.Types.ObjectId, ref: "Script", required: true },
    pcId: { type: mongoose.Schema.Types.ObjectId, ref: "Pc", required: true },
    status: { type: String, enum: ["success", "failed", "pending"], default: "pending" },
    output: { type: String },
    executedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ScriptLog", ScriptLogSchema);
