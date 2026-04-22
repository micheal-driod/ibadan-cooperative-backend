const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/profile", protect, (req, res) => {
  res.status(200).json({
    message: "Protected profile access successful",
    user: req.user,
  });
});

router.get("/admin-only", protect, authorize("admin"), (req, res) => {
  res.status(200).json({
    message: "Welcome Admin",
    user: req.user,
  });
});

module.exports = router;