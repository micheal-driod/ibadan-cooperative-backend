const express = require("express");
const router = express.Router();

const {
  postMonthlyLedgerEntry,
  getMemberLedger,
  getMemberFinancialSummary,
} = require("../controllers/ledgerController");

const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/post",
  protect,
  authorize("admin", "ict_officer"),
  postMonthlyLedgerEntry
);

// Allow members too
router.get(
  "/member/:memberId",
  protect,
  authorize("admin", "ict_officer", "loan_officer", "member"),
  getMemberLedger
);

router.get(
  "/member/:memberId/summary",
  protect,
  authorize("admin", "ict_officer", "loan_officer", "member"),
  getMemberFinancialSummary
);

module.exports = router;