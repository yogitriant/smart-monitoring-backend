// scripts/clearSpecs.js
const mongoose = require("mongoose");
const Spec = require("../models/Spec");

mongoose.connect("mongodb://localhost:27017/smart-monitoring"); // ganti sesuai .env kamu

async function run() {
  await Spec.deleteMany({});
  console.log("🧹 Semua data di collection Spec dihapus.");
  mongoose.disconnect();
}

run();
