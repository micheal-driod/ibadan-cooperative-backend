const express = require("express");
const router = express.Router();

const { protect, authorize } = require("../middleware/authMiddleware");

const {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require("../controllers/notificationController");

router.get("/", protect, authorize("member"), getMyNotifications);

router.patch("/:id/read", protect, authorize("member"), markNotificationAsRead);

router.patch("/mark-all/read", protect, authorize("member"), markAllNotificationsAsRead);

module.exports = router;