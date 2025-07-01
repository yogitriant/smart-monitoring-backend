const verifySuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "superadmin") {
    return res.status(403).json({ message: "Superadmin only." });
  }
  next();
};

module.exports = verifySuperAdmin;
