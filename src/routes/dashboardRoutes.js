const express = require("express");
const router = express.Router();

const { getMemberDashboard } = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/member", protect, authorize("member"), getMemberDashboard);

module.exports = router;