const express = require("express");
const router = express.Router();

const {
  previewBulkMonthlyPosting,
  importBulkMonthlyPosting,
  getMonthlyPostingBatches,
  getMonthlyPostingBatchById,
  updateMonthlyPostingRow,
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

router.get(
  "/batches",
  protect,
  authorize("admin", "ict_officer"),
  getMonthlyPostingBatches
);

router.get(
  "/batches/:id",
  protect,
  authorize("admin", "ict_officer"),
  getMonthlyPostingBatchById
);

router.patch(
  "/rows/:id",
  protect,
  authorize("admin", "ict_officer"),
  updateMonthlyPostingRow
);

module.exports = router;