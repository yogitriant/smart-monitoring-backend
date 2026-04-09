const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const User = require("../models/User");
const { loginLimiter, registerLimiter } = require("../middleware/rateLimiter");
const { validate, loginSchema, registerSchema, changePasswordSchema } = require("../middleware/validators");
const verifyToken = require("../middleware/verifyToken");
const bcrypt = require("bcrypt");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("❌ JWT_SECRET belum diset di environment variable!");
}

// 🔐 Login (rate limited + Joi validated)
router.post("/login", loginLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ username: email }, { email: email }],
    });

    if (!user) {
      return res.status(401).json({ message: "Username/email atau password salah." });
    }

    // ⛔ Cek apakah akun sedang terkunci
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(403).json({ 
        message: "Akun Anda terkunci sementara karena terlalu banyak percobaan login yang gagal. Silakan coba lagi nanti." 
      });
    }

    const valid = await user.comparePassword(password);
    
    if (!valid) {
      // Atomic increment untuk menghindari TOCTOU race conditions
      await User.updateOne(
        { _id: user._id },
        { $inc: { loginAttempts: 1 } }
      );
      
      const updatedUser = await User.findById(user._id);
      if (updatedUser.loginAttempts >= 5) {
        await User.updateOne(
          { _id: user._id },
          { $set: { lockUntil: Date.now() + 15 * 60 * 1000 } } // Lock selama 15 menit
        );
      }
      return res.status(401).json({ message: "Username/email atau password salah." });
    }
    
    // Reset login attempts saat login sukses
    await User.updateOne(
      { _id: user._id },
      { $set: { loginAttempts: 0, lockUntil: undefined } }
    );

    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        site: user.site,
        department: user.department,
      },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        username: user.username,
        email: user.email,
        role: user.role,
        site: user.site,
        department: user.department,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Terjadi kesalahan server saat login." });
  }
});

// 📝 Register (rate limited + Joi validated)
router.post("/register", registerLimiter, validate(registerSchema), async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      // 🕵️ Memberikan pesan generik untuk mencegah Account Enumeration
      return res
        .status(400)
        .json({ message: "Registrasi gagal. Cek kembali data yang dimasukkan atau hubungi administrator jika Anda sudah memiliki akun." });
    }

    // ⛔ Role selalu "user" via public register — hanya superadmin
    // yang bisa mengubah role melalui endpoint terpisah.
    const newUser = new User({
      username,
      email,
      password,
      role: "user",
    });
    await newUser.save();

    res.status(201).json({ message: "Registrasi berhasil." });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ message: "Gagal melakukan registrasi." });
  }
});

// 🔑 Change Password
router.post("/change-password", verifyToken, validate(changePasswordSchema), async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User tidak ditemukan." });

    const valid = await user.comparePassword(oldPassword);
    if (!valid) return res.status(401).json({ message: "Password lama salah." });

    user.password = newPassword; // akan di-hash oleh pre-save hook
    await user.save();

    res.json({ message: "Password berhasil diubah." });
  } catch (err) {
    console.error("Change password error:", err.message);
    res.status(500).json({ message: "Gagal merubah password." });
  }
});

module.exports = router;
