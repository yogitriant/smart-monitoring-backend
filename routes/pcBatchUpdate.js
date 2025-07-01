const express = require("express");
const router = express.Router();
const Pc = require("../models/Pc");

// PUT /api/pc/batch-update
router.put("/batch-update", async (req, res) => {
  const { locationId, idleTimeout, shutdownDelay } = req.body;

  if (!locationId || idleTimeout === undefined || shutdownDelay === undefined) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const result = await Pc.updateMany(
      { location: locationId },
      {
        $set: {
          idleTimeout,
          shutdownDelay,
        },
      }
    );

    res.json({ updatedCount: result.modifiedCount });
  } catch (err) {
    console.error("❌ Gagal update massal:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
