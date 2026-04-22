const express = require("express");
const router = express.Router();

const {
  previewBulkMonthlyPosting,
  importBulkMonthlyPosting,
} = require("../controllers/bulkMonthlyPostingController");

const { protect, authorize } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");

router.post(
  "/preview",
  protect,
  authorize("admin", "ict_officer"),
  upload.single("file"),
  previewBulkMonthlyPosting
);

router.post(
  "/import",
  protect,
  authorize("admin", "ict_officer"),
  upload.single("file"),
  importBulkMonthlyPosting
);

module.exports = router;