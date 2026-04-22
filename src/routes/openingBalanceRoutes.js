const express = require("express");
const router = express.Router();

const {
  previewOpeningBalances,
  importOpeningBalances,
} = require("../controllers/openingBalanceController");

const { protect, authorize } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");

router.post(
  "/preview",
  protect,
  authorize("admin", "ict_officer"),
  upload.single("file"),
  previewOpeningBalances
);

router.post(
  "/import",
  protect,
  authorize("admin", "ict_officer"),
  upload.single("file"),
  importOpeningBalances
);

module.exports = router;