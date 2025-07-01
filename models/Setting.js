const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema({
  defaultTimeout: { type: Number, default: 0 },
  categoryTimeouts: [
    {
      category: String,
      timeout: Number,
    },
  ],
  uptimeInterval: { type: Number, default: 300 }, // 🆕 default: 5 menit (300 detik)
});

module.exports = mongoose.model("Setting", settingSchema);
