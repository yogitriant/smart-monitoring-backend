const express = require("express");
const router = express.Router();
const User = require("../models/User");
const verifyToken = require("../middleware/verifyToken");
const verifySuperAdmin = require("../middleware/verifySuperAdmin");

// ✅ Route hanya bisa diakses admin yang sudah login
router.get("/", verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const users = await User.find({}, "username email role createdAt").sort({
      createdAt: -1,
    });
    res.json(users);
  } catch (err) {
    console.error("Gagal ambil daftar user:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/role", verifyToken, verifySuperAdmin, async (req, res) => {
  const { role } = req.body;
  const allowedRoles = ["user", "admin", "superadmin"];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Role tidak valid." });
  }

  try {
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }

    res.json({ message: "Role berhasil diperbarui", user: updated });
  } catch (err) {
    console.error("❌ Gagal ubah role:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }
    res.json({ message: "User berhasil dihapus." });
  } catch (err) {
    console.error("Gagal hapus user:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
