const mongoose = require("mongoose");

const picSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: false },
  department: { type: String, default: "-" },
  phone: { type: String },
}, { timestamps: true });

// Supaya tidak dobel PIC dengan email sama
picSchema.index({ email: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Pic", picSchema);
