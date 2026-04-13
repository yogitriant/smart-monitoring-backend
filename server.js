require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");
const { setSocketIo } = require("./socketRegistry");
const { registerSocketHandlers } = require("./handlers/socketHandlers");

// Routes
const authRoute = require("./routes/auth");
const versionRoute = require("./routes/version");
const pcConfigRoute = require("./routes/pcConfig");
const batchUpdateRoute = require("./routes/pcBatchUpdate");
const registerRoute = require("./routes/register");
const specRoute = require("./routes/spec");
const specHistoryRoute = require("./routes/specHistory");
const performanceRoute = require("./routes/performance");
const pcListRoute = require("./routes/pcList");
const settingRoute = require("./routes/settings");
const locationRoute = require("./routes/location");
const pcDetailRoutes = require("./routes/pcDetail");
const pcUpdateRoutes = require("./routes/pcUpdate");
const powerRoutes = require("./routes/power");
const userRoutes = require("./routes/user");
const logRoute = require("./routes/log");
const opnameRoute = require("./routes/opnameReport");
const idleLogRoute = require("./routes/idleLog");
const uptimeRoutes = require("./routes/uptime");
const installedAppsRoute = require("./routes/installedApps");
const agentUploadRoutes = require("./routes/agentUpdate");
const agentVersionRoutes = require("./routes/agentVersionRoutes");
const agentPushRoute = require("./routes/agentPush");
const assetRoute = require("./routes/asset");
const assetHistoryRoute = require("./routes/assetHistory");
const fieldOptionRoute = require("./routes/fieldOption");
const categoryItemRoute = require("./routes/categoryItem");
const regionSiteItemRoute = require("./routes/regionSiteItem");
const analyticsRoute = require("./routes/analytics");
const scriptRoute = require("./routes/scriptRoutes");
const geolocationRoute = require("./routes/geolocation");

// ============ CORS ORIGINS (dari .env) ============ //
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
  : ["http://localhost:5173"];

// ============ APP & SERVER ============ //
const app = express();
// server.js
// Trigger backend restart
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Register io instance agar bisa diakses routes via socketRegistry
setSocketIo(io);

// ============ MIDDLEWARE ============ //
app.set("trust proxy", 1);
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());

// ============ API ROUTES ============ //
app.use("/api", authRoute);
app.use("/api/version", versionRoute);
app.use("/api/pc", pcConfigRoute);
app.use("/api/pc", batchUpdateRoute);
app.use("/api/spec", specRoute);
app.use("/api/spec-history", specHistoryRoute);
app.use("/api/performance", performanceRoute);
app.use("/api/pc", pcListRoute);
app.use("/api/pc/list", pcListRoute);
app.use("/api/settings", settingRoute);
app.use("/api/location", locationRoute);
app.use("/api/pc", pcDetailRoutes);
app.use("/api/pc", pcUpdateRoutes);
app.use("/api/pc", registerRoute);
app.use("/api/power", powerRoutes);
app.use("/api/users", userRoutes);
app.use("/api/logs", logRoute);
app.use("/api/opname", opnameRoute);
app.use("/api/uptime", uptimeRoutes);
app.use("/api/installed-apps", installedAppsRoute);
app.use("/api/idle-log", idleLogRoute);
app.use("/api/agent", agentVersionRoutes);
app.use("/api/agent", agentUploadRoutes);
app.use("/api/agent", agentPushRoute);
app.use("/api/assets", assetRoute);
app.use("/api/assets", assetHistoryRoute);
app.use("/api/field-options", fieldOptionRoute);
app.use("/api/category-items", categoryItemRoute);
app.use("/api/region-site-items", regionSiteItemRoute);
app.use("/api/analytics", analyticsRoute);
app.use("/api/scripts", scriptRoute);
app.use("/api/geolocation", geolocationRoute);
app.use(
  "/agent_versions",
  express.static(path.join(__dirname, "public", "agent_versions"))
);

// ============ GLOBAL ERROR HANDLER ============ //
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

// ============ SOCKET.IO ============ //
registerSocketHandlers(io);

// ============ MONGODB CONNECT ============ //
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err.message));

// ============ START SERVER ============ //
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server + Socket.IO running on port ${PORT}`);
});

