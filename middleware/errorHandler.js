/**
 * Global error handler middleware
 * Menangkap semua error yang tidak ter-catch di route handlers
 */
const errorHandler = (err, req, res, next) => {
  // Log error detail ke console (tapi jangan expose ke client)
  console.error("❌ Unhandled error:", {
    message: err.message,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      message: "Validasi gagal",
      errors: messages,
    });
  }

  // Mongoose cast error (invalid ObjectId, etc)
  if (err.name === "CastError") {
    return res.status(400).json({
      message: `Format tidak valid untuk field: ${err.path}`,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ message: "Token tidak valid" });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Token sudah expired" });
  }

  // Multer file upload errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "Ukuran file terlalu besar" });
  }

  // Default: 500 Internal Server Error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message:
      process.env.NODE_ENV === "production"
        ? "Terjadi kesalahan server"
        : err.message || "Terjadi kesalahan server",
  });
};

module.exports = errorHandler;
