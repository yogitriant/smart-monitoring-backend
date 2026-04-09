const express = require("express");
const router = express.Router();
const User = require("../models/User");
const verifyToken = require("../middleware/verifyToken");
const verifySuperAdmin = require("../middleware/verifySuperAdmin");

// ✅ Route hanya bisa diakses admin yang sudah login
router.get("/", verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const users = await User.find({}, "username email role site department createdAt").sort({
      createdAt: -1,
    });
    res.json(users);
  } catch (err) {
    console.error("Gagal ambil daftar user:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Route untuk create user oleh superadmin
router.post("/", verifyToken, verifySuperAdmin, async (req, res) => {
  const { username, email, password, role, site, department } = req.body;
  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(409).json({ message: "Username atau email sudah digunakan." });
    }
    const newUser = new User({
      username,
      email,
      password,
      role: role || "user",
      site: site || "",
      department: department || "",
    });
    await newUser.save();
    res.status(201).json({ message: "User berhasil dibuat", user: newUser });
  } catch (err) {
    console.error("❌ Gagal create user:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Route untuk update user secara lengkap (role, site, department, dll)
router.put("/:id", verifyToken, verifySuperAdmin, async (req, res) => {
  const { username, email, role, site, department, password } = req.body;
  const allowedRoles = ["user", "admin", "superadmin"];

  if (role && !allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Role tidak valid." });
  }

  try {
    const userToUpdate = await User.findById(req.params.id);
    if (!userToUpdate) return res.status(404).json({ message: "User tidak ditemukan." });

    if (username) userToUpdate.username = username;
    if (email) userToUpdate.email = email;
    if (role) userToUpdate.role = role;
    if (site !== undefined) userToUpdate.site = site;
    if (department !== undefined) userToUpdate.department = department;
    
    // Jika password diisi, field ini akan otomatis dihash oleh middleware pre-save
    if (password) {
      userToUpdate.password = password;
    }

    await userToUpdate.save();

    res.json({ message: "User berhasil diperbarui", user: userToUpdate });
  } catch (err) {
    console.error("❌ Gagal update user:", err.message);
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
