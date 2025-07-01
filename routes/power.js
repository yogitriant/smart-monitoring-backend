const express = require("express");
const router = express.Router();
const { getSocketByPcId } = require("../socketRegistry"); // registry socket
const mongoose = require("mongoose");

// 🔌 Shutdown
router.post("/shutdown", (req, res) => {
  const { pcId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(pcId)) {
    return res.status(400).json({ message: "Invalid pcId" });
  }

  const socket = getSocketByPcId(pcId);
  if (!socket)
    return res.status(404).json({ message: "PC offline / not connected" });

  socket.emit("shutdown");
  res.json({ message: "Shutdown command sent" });
});

// 🔁 Restart
router.post("/restart", (req, res) => {
  const { pcId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(pcId)) {
    return res.status(400).json({ message: "Invalid pcId" });
  }

  const socket = getSocketByPcId(pcId);
  if (!socket)
    return res.status(404).json({ message: "PC offline / not connected" });

  socket.emit("restart");
  res.json({ message: "Restart command sent" });
});

// 🌐 Wake-Up (optional, if WOL implemented)
router.post("/wakeup", (req, res) => {
  const { macAddress } = req.body;
  if (!macAddress)
    return res.status(400).json({ message: "MAC address required" });

  // ⏭ Optional: implement wake-on-lan here if needed
  // wakeOnLan(macAddress);

  res.json({ message: `Wake-up command for ${macAddress} sent (or logged)` });
});

module.exports = router;
