const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "smartmonitoring-secret";

// 🔐 Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body; // frontend tetap kirim "email" (bisa email/username)

  try {
    const user = await User.findOne({
      $or: [{ username: email }, { email: email }],
    });

    const valid = user && (await user.comparePassword(password));
    if (!valid) {
      return res
        .status(401)
        .json({ message: "Username/email atau password salah." });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
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
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Terjadi kesalahan server saat login." });
  }
});

// 📝 Register
router.post("/register", async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ message: "Username, email, dan password wajib diisi." });
  }

  // Validasi format email sederhana
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: "Format email tidak valid." });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "Username atau email sudah digunakan." });
    }

    const newUser = new User({
      username,
      email,
      password,
      role: role || "user",
    });
    await newUser.save();

    res.status(201).json({ message: "Registrasi berhasil." });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ message: "Gagal melakukan registrasi." });
  }
});

module.exports = router;
