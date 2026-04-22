const express = require("express");
const router = express.Router();

const {
  getMyProfile,
  updateMyProfile,
  submitPasswordChangeRequest,
  getMyPasswordChangeRequests,
} = require("../controllers/memberSelfController");

const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/profile", protect, authorize("member"), getMyProfile);
router.put("/profile", protect, authorize("member"), updateMyProfile);

router.post(
  "/password-change-request",
  protect,
  authorize("member"),
  submitPasswordChangeRequest
);

router.get(
  "/password-change-request",
  protect,
  authorize("member"),
  getMyPasswordChangeRequests
);

module.exports = router;