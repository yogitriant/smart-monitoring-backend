const mongoose = require("mongoose");
require("../models/Spec"); // pastikan ini tertarik

mongoose.connect("mongodb://localhost:27017/smart-monitoring-db").then(() => {
  console.log("🧠 Mongoose models terdaftar:", mongoose.modelNames());
  mongoose.disconnect();
});
