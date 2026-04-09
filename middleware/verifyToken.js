const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("❌ JWT_SECRET belum diset di environment variable!");
}

const verifyToken = (req, res, next) => {
  // ✅ Bypass auth untuk /api/pc/register (boleh ditambah lainnya kalau perlu)
  if (
    req.method === "POST" &&
    (req.path === "/pc/register" || req.originalUrl === "/api/pc/register")
  ) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token tidak ditemukan." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ message: "Token tidak valid." });
  }
};

module.exports = verifyToken;
