const express = require("express");
const router = express.Router();

const {
  previewBulkOnboarding,
  importBulkOnboarding,
} = require("../controllers/bulkOnboardingController");

const { protect, authorize } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");

router.post(
  "/preview",
  protect,
  authorize("admin", "ict_officer"),
  upload.single("file"),
  previewBulkOnboarding
);

router.post(
  "/import",
  protect,
  authorize("admin", "ict_officer"),
  upload.single("file"),
  importBulkOnboarding
);

module.exports = router;