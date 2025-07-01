const verifyAdmin = (req, res, next) => {
  if (
    !req.user ||
    (req.user.role !== "admin" && req.user.role !== "superadmin")
  ) {
    return res.status(403).json({ message: "Admin access only." });
  }
  next();
};

module.exports = verifyAdmin;
