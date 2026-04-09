const rateLimit = require("express-rate-limit");

// 🔒 Rate limiter untuk login — max 10 percobaan per 15 menit per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10,
  message: {
    message: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🔒 Rate limiter untuk register — max 5 percobaan per 15 menit per IP
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    message: "Terlalu banyak percobaan registrasi. Coba lagi dalam 15 menit.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, registerLimiter };
