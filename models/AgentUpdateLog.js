// backend/models/AgentUpdateLog.js
const mongoose = require("mongoose");

const agentUpdateLogSchema = new mongoose.Schema({
  pcId: { type: String, required: true },
  version: { type: String, required: true },
  action: { type: String, enum: ["update", "rollback"], default: "update" },
  status: { type: String, enum: ["success", "failed"], required: true },
  message: { type: String },
  initiatedBy: { type: String },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("AgentUpdateLog", agentUpdateLogSchema);
