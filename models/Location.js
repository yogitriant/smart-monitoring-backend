const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  category: String,
  room: String,
  floor: String,
  campus: String,
}, { timestamps: true });

module.exports = mongoose.model("Location", locationSchema);
