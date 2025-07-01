// models/UpdateLog.js
const mongoose = require("mongoose");

const updateLogSchema = new mongoose.Schema({
  pcId: { type: mongoose.Schema.Types.ObjectId, ref: "PC" },
  changedFields: Object,
  updatedBy: String,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("UpdateLog", updateLogSchema);
