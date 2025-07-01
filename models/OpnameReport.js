// models/OpnameReport.js
const mongoose = require("mongoose");
const crypto = require("crypto");

const reportItemSchema = new mongoose.Schema({
  pcObjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Pc", // opsional, hanya kalau kamu mau populate
    required: true,
  },
  pic: String,
  pcId: { type: String, required: true },
  serialNumber: String,
  assetNumber: String,
  location: String,
  ram: String,
  storage: String,
  status: {
    type: String,
    enum: ["-", "hadir", "tidak hadir", "rusak"],
    default: "-",
  },
  kondisi: String,
  keterangan: String,
  updatedBy: String,
  updatedAt: Date,
});

const opnameReportSchema = new mongoose.Schema({
  reportName: String,
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  publicToken: { type: String, unique: true },
  items: [reportItemSchema],
});

opnameReportSchema.pre("save", function (next) {
  if (!this.publicToken) {
    this.publicToken = crypto.randomBytes(16).toString("hex");
  }
  next();
});

module.exports = mongoose.model("OpnameReport", opnameReportSchema);
