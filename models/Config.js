const mongoose = require("mongoose");

const configSchema = new mongoose.Schema({
  latestVersion: String,    // versi agent terbaru, contoh: "1.2.0"
  updateUrl: String,        // link download ZIP update agent
  forceUpdate: {            // jika true, agent harus update sebelum jalan
    type: Boolean,
    default: false,
  },
  note: String,             // catatan atau changelog versi baru
}, { timestamps: true });

module.exports = mongoose.model("Config", configSchema);
