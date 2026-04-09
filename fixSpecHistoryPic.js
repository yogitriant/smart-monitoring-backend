// fixSpecHistoryPic.js
const mongoose = require("mongoose");
const SpecHistory = require("./models/SpecHistory");

mongoose.connect("mongodb://localhost:27017/smartmon", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

function normalizePic(pic) {
  if (!pic) return null;
  if (typeof pic !== "object") return { name: pic };

  return {
    name: pic.name || "-",
    email: pic.email || "-",
    department: pic.department || "-",
    phone: pic.phone || "-",
  };
}

(async () => {
  const logs = await SpecHistory.find({});
  for (let log of logs) {
    let updated = false;

    if (log.oldSpec?.pic) {
      log.oldSpec.pic = normalizePic(log.oldSpec.pic);
      updated = true;
    }
    if (log.newSpec?.pic) {
      log.newSpec.pic = normalizePic(log.newSpec.pic);
      updated = true;
    }

    if (updated) {
      await log.save();
      console.log("✅ Fixed SpecHistory:", log._id);
    }
  }

  console.log("🎉 Done fixing SpecHistory PIC");
  process.exit(0);
})();
