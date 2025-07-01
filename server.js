require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");

// HTTP-fetch shim
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Models
const Performance = require("./models/Performance");
const Pc = require("./models/Pc");
const Uptime = require("./models/Uptime");
const AgentVersion = require("./models/AgentVersion");
const AgentUpdateLog = require("./models/AgentUpdateLog");
const InstalledApp = require("./models/InstalledApp");

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
const uptimeRoutes = require("./routes/uptime");
const installedAppsRoute = require("./routes/installedApps");

// Agent update routes
const agentUploadRoutes = require("./routes/agentUpdate"); // POST /api/agent/upload, GET /api/agent/logs
const agentVersionRoutes = require("./routes/agentVersionRoutes"); // GET /api/agent/versions
const agentPushRoute = require("./routes/agentPush");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://10.20.0.71:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ============ MIDDLEWARE ============ //
app.use(
  cors({
    origin: ["http://localhost:5173", "http://10.20.0.71:5173"],
    credentials: true,
  })
);

app.use(express.json());

// ============ API ROUTES ============ //
app.use("/api", authRoute);
app.use("/api/version", versionRoute);
app.use("/api/pc", pcConfigRoute);
app.use("/api/pc", batchUpdateRoute);
app.use("/api/pc", registerRoute);
app.use("/api/spec", specRoute);
app.use("/api/spec-history", specHistoryRoute);
app.use("/api/performance", performanceRoute);
app.use("/api/pc", pcListRoute);
app.use("/api/pc/list", pcListRoute);

app.use("/api/settings", settingRoute);
app.use("/api/location", locationRoute);
app.use("/api/pc", pcDetailRoutes);
app.use("/api/pc", pcUpdateRoutes);
app.use("/api/power", powerRoutes);
app.use("/api/users", userRoutes);
app.use("/api/logs", logRoute);
app.use("/api/opname", opnameRoute);
app.use("/api/uptime", uptimeRoutes);
app.use("/api/installed-apps", installedAppsRoute);

// Agent update endpoints
app.use("/api/agent", agentVersionRoutes); // GET /api/agent/versions
app.use("/api/agent", agentUploadRoutes); // POST /api/agent/upload & GET /api/agent/logs
app.use("/api/agent", agentPushRoute); // <-- tambahkan ini
app.use(
  "/agent_versions",
  express.static(path.join(__dirname, "public", "agent_versions"))
);

// ============ SOCKET.IO SETUP ============ //
const socketMap = new Map();

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  // Agent joins its room by pcId
  socket.on("join-room", async (pcId) => {
    socketMap.set(pcId, socket.id);
    socket.join(pcId);
    console.log(`✅ PC ${pcId} joined room`);

    // ✅ Tambahkan ini: langsung tandai status online
    try {
      const pc = await Pc.findOne({ pcId });
      if (pc) {
        await Pc.findByIdAndUpdate(pc._id, {
          status: "online",
          lastActive: new Date(),
        });
        console.log(`🟢 Set PC ${pcId} to online`);
      }
    } catch (err) {
      console.error("❌ Error setting online status:", err.message);
    }
  });

  // Forward update/rollback from dashboard → agent
  socket.on("agent-update", (payload) => {
    const { pcId } = payload;
    io.to(pcId).emit("agent-update", payload);
    console.log(`➡️ Forwarded agent-update to PC ${pcId}:`, payload);
  });

  // Receive result from agent → log & update PC record
  socket.on("agent-update-result", async (data) => {
    try {
      const { pcId, version, status, message, action = "update" } = data;

      // a) save to AgentUpdateLog
      await AgentUpdateLog.create({
        pcId,
        version,
        action,
        status,
        message,
        timestamp: new Date(),
      });

      // b) if success, update Pc.agentVersion
      if (status === "success") {
        await Pc.findByIdAndUpdate(pcId, { agentVersion: version });
      }

      console.log(`✅ Logged agent-update-result for ${pcId}:`, data);
    } catch (err) {
      console.error("❌ Error saving agent-update-result:", err);
    }
  });

  // ============ Other Monitoring Socket Events ============ //
  socket.on("performance", async (data) => {
    try {
      const perf = new Performance({
        ...data,
        pc: new mongoose.Types.ObjectId(data.pc),
      });
      await perf.save();
    } catch (err) {
      console.error("❌ Performance save error:", err.message);
    }
  });

  socket.on("uptime", async (data) => {
    const { pc, date, uptimeSession, uptimeTotalToday } = data;
    try {
      await Uptime.findOneAndUpdate(
        { pc, date },
        { uptimeSession, uptimeTotalToday },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      console.error("❌ Uptime save error:", err.message);
    }
  });

  socket.on("status", async ({ pcId, status, timestamp }) => {
    console.log("[BACKEND] Received status:", pcId, status);

    try {
      // Validasi apakah pcId adalah ObjectId valid
      if (!mongoose.Types.ObjectId.isValid(pcId)) {
        console.warn("⚠️ Invalid MongoDB ObjectId:", pcId);
        return;
      }

      const updated = await Pc.findByIdAndUpdate(
        pcId,
        {
          status,
          lastActive: timestamp || new Date(),
        },
        { new: true }
      );

      if (!updated) {
        console.warn("⚠️ PC _id tidak ditemukan:", pcId);
      } else {
        console.log(`✅ Status updated for _id ${pcId}: ${status}`);
      }
    } catch (err) {
      console.error("❌ Status update error:", err.message);
    }
  });

  socket.on("spec", async (data) => {
    try {
      const res = await fetch(`${process.env.BASE_URL}/api/spec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const errorText = await res.text();
      console.error("❌ Spec forward error:", errorText);
      throw new Error(errorText);
    } catch (err) {
      console.error("❌ Spec forward error:", err.message);
    }
  });

  // Cleanup on disconnect
  socket.on("disconnect", async () => {
    for (const [pcId, sId] of socketMap.entries()) {
      if (sId === socket.id) {
        socketMap.delete(pcId);
        try {
          await Pc.findByIdAndUpdate(pcId, {
            status: "offline",
            lastActive: new Date(),
          });
          console.log(`🔴 Set PC ${pcId} to offline`);
        } catch (err) {
          console.error("❌ Offline status error:", err.message);
        }
        break;
      }
    }
  });
});

// ============ MONGODB CONNECT ============ //
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err.message));

// ============ START SERVER ============ //
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server + Socket.IO running on port ${PORT}`);
});
