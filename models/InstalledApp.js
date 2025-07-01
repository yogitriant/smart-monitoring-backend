const mongoose = require("mongoose");

const installedAppSchema = new mongoose.Schema(
  {
    pc: { type: mongoose.Schema.Types.ObjectId, ref: "PC", required: true },
    apps: [
      {
        DisplayName: String,
        DisplayVersion: String,
        Publisher: String,
        InstallDate: String,
      },
    ],
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InstalledApp", installedAppSchema);
