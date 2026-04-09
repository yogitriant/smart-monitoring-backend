const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Script = require("../models/Script");
const ScriptLog = require("../models/ScriptLog");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");
const { getSocketIo } = require("../socketRegistry");

// 1. Get all scripts
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const scripts = await Script.find().sort({ createdAt: -1 });
    res.json(scripts);
  } catch (error) {
    console.error("Error fetching scripts:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// 2. Get script by ID
router.get("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const script = await Script.findById(req.params.id);
    if (!script) return res.status(404).json({ message: "Script not found" });
    res.json(script);
  } catch (error) {
    console.error("Error fetching script:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// 3. Create a new script
router.post("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name, description, content, type } = req.body;
    const newScript = new Script({
      name,
      description,
      content,
      type,
      createdBy: req.user ? req.user.id : null,
    });
    await newScript.save();
    res.status(201).json(newScript);
  } catch (error) {
    console.error("Error creating script:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// 3.5 Update a script
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name, description, content, type } = req.body;
    const script = await Script.findByIdAndUpdate(
      req.params.id,
      { name, description, content, type },
      { new: true }
    );
    if (!script) return res.status(404).json({ message: "Script not found" });
    res.json(script);
  } catch (error) {
    console.error("Error updating script:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// 4. Delete a script
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const script = await Script.findByIdAndDelete(req.params.id);
    if (!script) return res.status(404).json({ message: "Script not found" });
    res.json({ message: "Script deleted successfully" });
  } catch (error) {
    console.error("Error deleting script:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// 5. Execute script on one or multiple PCs
router.post("/execute", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { scriptId, pcIds } = req.body; // pcIds can be an array

    if (!scriptId || !pcIds || !Array.isArray(pcIds) || pcIds.length === 0) {
      return res.status(400).json({ message: "scriptId and array of pcIds are required" });
    }

    const script = await Script.findById(scriptId);
    if (!script) {
      return res.status(404).json({ message: "Script not found" });
    }

    const io = getSocketIo();
    const createdLogs = [];

    // Proses untuk setiap target PC
    for (const pcId of pcIds) {
      if (!mongoose.Types.ObjectId.isValid(pcId)) continue;

      // Buat entri log pending terlebih dahulu
      const logEntry = new ScriptLog({
        scriptId: script._id,
        pcId: pcId,
        status: "pending",
        executedBy: req.user ? req.user.id : null,
      });
      await logEntry.save();
      createdLogs.push(logEntry);

      // Emit command ke agen tertentu (agen join room sesuai pcId masing-masing)
      io.to(pcId).emit("run-script", {
        scriptId: script._id.toString(),
        logId: logEntry._id.toString(),
        name: script.name,
        type: script.type,
        content: script.content,
      });
    }

    res.status(200).json({ message: "Execution commands dispatched", logs: createdLogs });
  } catch (error) {
    console.error("Error executing script:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// 6. Get execution logs for a script
router.get("/logs/:scriptId", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const logs = await ScriptLog.find({ scriptId: req.params.scriptId })
      .populate("pcId", "pcId serialNumber userLogin ipAddress")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(logs);
  } catch (error) {
    console.error("Error fetching script logs:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
