// handlers/socketHandlers.js
// Semua socket.io event handler dipindahkan dari server.js ke sini

const mongoose = require("mongoose");
const axios = require("axios");
const Performance = require("../models/Performance");
const Pc = require("../models/Pc");
const Uptime = require("../models/Uptime");
const AgentUpdateLog = require("../models/AgentUpdateLog");
const ScriptLog = require("../models/ScriptLog");
const { applyIdleThreshold } = require("../utils/idleHelper");
const { processSpec } = require("../services/specProcessor");
const { resolveGeolocation } = require("../utils/geoResolver");

const socketMap = new Map();

// 🌍 Server discovers its own Public IP at startup (shared by all PCs behind same NAT)
let serverPublicIp = null;
(async () => {
  try {
    const res = await axios.get("https://api.ipify.org?format=json", { timeout: 8000 });
    serverPublicIp = res.data.ip;
    console.log(`🌍 Server Public IP detected: ${serverPublicIp}`);
  } catch (err) {
    console.warn("⚠️ Could not detect server public IP:", err.message);
  }
})();

function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    // Agent joins its room by pcId
    socket.on("join-room", async (pcId) => {
      socketMap.set(pcId, socket.id);
      socket.join(pcId);

      try {
        const pc = await Pc.findOne({ pcId });
        if (pc) {
          await Pc.findByIdAndUpdate(pc._id, {
            status: "online",
            lastActive: new Date(),
          });
          console.log(`🟢 Set PC ${pcId} to online`);

          // 🗺️ Resolve Geolocation (non-blocking)
          if (!pc.geolocation?.lat) {
            try {
              // Gunakan server's public IP sebagai fallback karena semua PC di belakang NAT yang sama
              const geo = await resolveGeolocation(pc.site, serverPublicIp);
              if (geo) {
                await Pc.findByIdAndUpdate(pc._id, {
                  "geolocation.lat": geo.lat,
                  "geolocation.lng": geo.lng,
                  "geolocation.city": geo.city,
                  "geolocation.source": geo.source,
                  "geolocation.lastUpdated": new Date(),
                });
                console.log(`🗺️ Geo resolved for ${pcId}: ${geo.city} (${geo.source})`);
              }
            } catch (geoErr) {
              console.warn("⚠️ Geo resolve failed:", geoErr.message);
            }
          }
        }
      } catch (err) {
        console.error("❌ Error setting online status:", err.message);
      }
    });

    // Forward update/rollback from dashboard → agent
    socket.on("agent-update", (payload) => {
      const { pcId } = payload;
      io.to(pcId).emit("agent-update", payload);
    });

    // Receive result from agent → log & update PC record
    socket.on("agent-update-result", async (data) => {
      try {
        const { pcId, version, status, message, action = "update" } = data;

        await AgentUpdateLog.create({
          pcId,
          version,
          action,
          status,
          message,
          timestamp: new Date(),
        });

        if (status === "success" && mongoose.Types.ObjectId.isValid(pcId)) {
          await Pc.findByIdAndUpdate(pcId, { agentVersion: version });
        }

        console.log(`✅ Logged agent-update-result for ${pcId}:`, data);
      } catch (err) {
        console.error("❌ Error saving agent-update-result:", err);
      }
    });

    // Receive script execution result from agent
    socket.on("script-result", async (data) => {
      try {
        const { logId, status, output } = data;
        if (mongoose.Types.ObjectId.isValid(logId)) {
          await ScriptLog.findByIdAndUpdate(logId, {
            status,
            output,
          });
          console.log(`✅ Logged script-result for ${logId}`);
        } else {
          console.warn("⚠️ Invalid logId for script-result:", logId);
        }
      } catch (err) {
        console.error("❌ Error saving script-result:", err);
      }
    });

    // Performance data from agent
    socket.on("performance", async (data) => {
      try {
        const { pc, cpuUsage, ramUsage, diskUsage, diskHealth, battery, activeIp, publicIp, gpsLocation, uptime, agentUptime, idleTime, timestamp } = data;

        const pcDoc = await Pc.findById(pc).lean();
        const threshold = pcDoc?.idleTimeout || 300;
        const { status, idleTime: idleFor } = applyIdleThreshold(idleTime, threshold);

        await Performance.create({
          pc,
          cpuUsage,
          ramUsage,
          diskUsage,
          diskHealth,
          battery,
          activeIp,
          uptime,
          agentUptime,
          idleRaw: idleTime,
          idleTime: idleFor,
          timestamp: timestamp || new Date(),
        });

        await Pc.updateOne(
          { _id: pc },
          {
            $set: {
              status,
              "performance.cpuUsage": cpuUsage,
              "performance.ramUsage": ramUsage,
              "performance.diskUsage": diskUsage,
              "performance.idleRaw": idleTime,
              "performance.idleTime": idleFor,
              "performance.battery": battery,
              "performance.diskHealth": diskHealth,
              ipAddress: activeIp || pcDoc?.ipAddress,
              lastActive: new Date(),
            },
          }
        );

        // 🗺️ Geolocation Resolution — Prioritas: GPS Agent > Site > IP
        try {
          if (gpsLocation && gpsLocation.lat && gpsLocation.lng) {
            // ✅ PRIORITAS 1: GPS presisi dari Windows Location API (level gedung/jalan)
            await Pc.updateOne({ _id: pc }, {
              $set: {
                "geolocation.lat": gpsLocation.lat,
                "geolocation.lng": gpsLocation.lng,
                "geolocation.city": `GPS (±${gpsLocation.accuracy || "?"}m)`,
                "geolocation.source": "gps",
                "geolocation.lastUpdated": new Date(),
              }
            });
          } else if (!pcDoc?.geolocation?.lat || pcDoc?.geolocation?.source === "ip") {
            // ⬇️ PRIORITAS 2 & 3: Site master data atau IP Geolocation (fallback)
            const ipToResolve = publicIp || serverPublicIp;
            if (ipToResolve) {
              const geo = await resolveGeolocation(pcDoc?.site, ipToResolve);
              if (geo) {
                await Pc.updateOne({ _id: pc }, {
                  $set: {
                    "geolocation.lat": geo.lat,
                    "geolocation.lng": geo.lng,
                    "geolocation.city": geo.city,
                    "geolocation.source": geo.source,
                    "geolocation.lastUpdated": new Date(),
                  }
                });
              }
            }
          }
        } catch (geoErr) {
          // Silent fail — geo is non-critical
        }
      } catch (err) {
        console.error("❌ Performance save error:", err.message);
      }
    });
    // Dashboard subscription
    socket.on("join-dashboard", (roomName) => {
      if (roomName) socket.join(roomName);
    });

    // Uptime data from agent
    socket.on("uptime", async (data) => {
      const { pc, date, uptimeSession, uptimeTotalToday } = data;
      try {
        await Uptime.findOneAndUpdate(
          { pc, date },
          { uptimeSession, uptimeTotalToday },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        io.to(pc).emit("uptime-update", { uptimeSession, uptimeTotalToday });
      } catch (err) {
        console.error("❌ Uptime save error:", err.message);
      }
    });

    // Status update from agent
    socket.on("status", async ({ pcId, status, version, timestamp }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(pcId)) {
          console.warn("⚠️ Invalid MongoDB ObjectId:", pcId);
          return;
        }

        const updateData = { status, lastActive: timestamp || new Date() };
        if (version) updateData.agentVersion = version;

        const updated = await Pc.findByIdAndUpdate(
          pcId,
          updateData,
          { new: true }
        );

        if (!updated) {
          console.warn("⚠️ PC _id tidak ditemukan:", pcId);
        }
      } catch (err) {
        console.error("❌ Status update error:", err.message);
      }
    });

    // ✅ Spec dari agent — panggil processSpec langsung (tanpa HTTP fetch)
    socket.on("spec", async (data) => {
      try {
        console.log("📥 [DEBUG] Raw spec payload received:", JSON.stringify(data).substring(0, 200) + "...");
        const result = await processSpec(data);

        if (result.message === "No spec changes") {
          console.log("ℹ️ Spesifikasi tidak berubah, tidak disimpan ulang.");
        } else {
          console.log("✅ Spesifikasi diproses:", result.message);
        }
      } catch (err) {
        console.error("❌ Spec processing error:", err.message);
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
}

module.exports = { registerSocketHandlers, socketMap };
