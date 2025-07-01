// models/AgentVersion.js
const mongoose = require("mongoose");

const agentVersionSchema = new mongoose.Schema({
  version: { type: String, required: true, unique: true },
  changelog: String,
  hash: String,
  uploadedBy: String,
  uploadDate: { type: Date, default: Date.now },
});

module.exports = mongoose.model("AgentVersion", agentVersionSchema);
