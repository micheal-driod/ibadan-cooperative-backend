const express = require("express");
const router = express.Router();

const {
  addExistingMember,
  getCredentialLogs,
  downloadCredentialLogsPdf,
} = require("../controllers/adminMemberOnboardingController");

const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/members",
  protect,
  authorize("admin", "ict_officer"),
  addExistingMember
);

router.get(
  "/credentials",
  protect,
  authorize("admin", "ict_officer"),
  getCredentialLogs
);

router.get(
  "/credentials/pdf",
  protect,
  authorize("admin", "ict_officer"),
  downloadCredentialLogsPdf
);

module.exports = router;