const mongoose = require("mongoose");

const diskSchema = new mongoose.Schema(
  {
    drive: {
      type: String,
      required: true,
      match: /^[A-Z]$/, // Hanya huruf besar, contoh: "C"
    },
    type: {
      type: String,
      required: true,
    },
    total: {
      type: String,
      required: true,
      match: /^\d+\s?(GB|TB)$/i, // tambahkan insensitive
    },
  },
  { _id: false } // agar tidak buat id baru untuk setiap item disk
);

const specSchema = new mongoose.Schema(
  {
    pc: { type: mongoose.Schema.Types.ObjectId, ref: "Pc", unique: true },
    brand: String,
    model: String,
    macAddress: {
      type: String,
      match: /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, // Format MAC Address
    },
    ipAddress: {
      type: String,
      validate: {
        validator: function (v) {
          return /^(\d{1,3}\.){3}\d{1,3}$/.test(v);
        },
        message: (props) => `${props.value} bukan IP Address yang valid!`,
      },
    },
    os: String,
    cpu: String,
    ram: {
      type: String,
      match: /^\d+\s?GB$/i, // 16 GB, 32GB (case-insensitive)
    },
    gpu: String,
    resolution: String,
    disk: [diskSchema],
    approved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Spec || mongoose.model("Spec", specSchema);
