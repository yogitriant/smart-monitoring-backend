// fixPcHistoryPic.js
const mongoose = require("mongoose");
const PcHistory = require("./models/PcHistory");

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
  const logs = await PcHistory.find({});
  for (let log of logs) {
    let updated = false;

    if (log.oldData?.pic) {
      log.oldData.pic = normalizePic(log.oldData.pic);
      updated = true;
    }
    if (log.newData?.pic) {
      log.newData.pic = normalizePic(log.newData.pic);
      updated = true;
    }

    if (updated) {
      await log.save();
      console.log("✅ Fixed PcHistory:", log._id);
    }
  }

  console.log("🎉 Done fixing PcHistory PIC");
  process.exit(0);
})();
