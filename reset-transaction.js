require("dotenv").config();
const mongoose = require("mongoose");

const Pc = require("./models/Pc");
const Asset = require("./models/Asset");
const Spec = require("./models/Spec");
const SpecHistory = require("./models/SpecHistory");
const Performance = require("./models/Performance");
const Uptime = require("./models/Uptime");
const InstalledApp = require("./models/InstalledApp");
const OpnameReport = require("./models/OpnameReport");
const IdleLog = require("./models/IdleLog");
const PcHistory = require("./models/PcHistory");
const AgentUpdateLog = require("./models/AgentUpdateLog");
const UpdateLog = require("./models/UpdateLog");
const ScriptLog = require("./models/ScriptLog");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/smart-monitoring-db";

async function clearData() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected!");

  const modelsToClear = [
    { name: "Pc", model: Pc },
    { name: "Asset", model: Asset },
    { name: "Spec", model: Spec },
    { name: "SpecHistory", model: SpecHistory },
    { name: "Performance", model: Performance },
    { name: "Uptime", model: Uptime },
    { name: "InstalledApp", model: InstalledApp },
    { name: "OpnameReport", model: OpnameReport },
    { name: "IdleLog", model: IdleLog },
    { name: "PcHistory", model: PcHistory },
    { name: "AgentUpdateLog", model: AgentUpdateLog },
    { name: "UpdateLog", model: UpdateLog },
    { name: "ScriptLog", model: ScriptLog },
  ];

  console.log("🗑️ Clearing transaction data (keeping Master Data)...");

  for (const item of modelsToClear) {
    try {
      const result = await item.model.deleteMany({});
      console.log(`- Cleared ${item.name}: ${result.deletedCount} documents removed.`);
    } catch (err) {
      console.log(`- ⚠️ Gagal clear ${item.name}: ${err.message}`);
    }
  }

  await mongoose.disconnect();
  console.log("🔌 Disconnected. Database is fresh for testing!");
}

clearData().catch((err) => {
  console.error("❌ Process failed:", err.message);
  process.exit(1);
});
