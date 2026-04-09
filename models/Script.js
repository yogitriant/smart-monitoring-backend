const mongoose = require("mongoose");

const ScriptSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    content: { type: String, required: true },
    type: { type: String, required: true, enum: ["bat", "ps1", "sh", "cmd"], default: "bat" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Script", ScriptSchema);
