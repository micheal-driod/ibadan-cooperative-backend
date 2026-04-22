const express = require("express");
const router = express.Router();

const {
  searchMembers,
  getMemberActiveLoans,
} = require("../controllers/adminSearchController");

const { protect, authorize } = require("../middleware/authMiddleware");

router.get(
  "/members",
  protect,
  authorize("admin", "ict_officer"),
  searchMembers
);

router.get(
  "/members/:memberId/active-loans",
  protect,
  authorize("admin", "ict_officer"),
  getMemberActiveLoans
);

module.exports = router;