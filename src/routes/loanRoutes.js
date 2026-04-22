const express = require("express");
const router = express.Router();

const {
  applyForLoan,
  getAllLoanApplications,
  getLoanApplicationById,
  getAllActiveLoans,
  getActiveLoanById,
  markLoanAsViewed,
  approveLoanApplication,
  rejectLoanApplication,
} = require("../controllers/loanController");

const { protect, authorize } = require("../middleware/authMiddleware");

// Member route
router.post("/apply", protect, authorize("member"), applyForLoan);

// Backend review routes
router.get(
  "/applications",
  protect,
  authorize("admin", "loan_officer", "ict_officer"),
  getAllLoanApplications
);

router.get(
  "/applications/:id",
  protect,
  authorize("admin", "loan_officer", "ict_officer"),
  getLoanApplicationById
);

router.patch(
  "/applications/:id/view",
  protect,
  authorize("admin", "loan_officer", "ict_officer"),
  markLoanAsViewed
);

router.patch(
  "/applications/:id/approve",
  protect,
  authorize("admin", "loan_officer", "ict_officer"),
  approveLoanApplication
);

router.patch(
  "/applications/:id/reject",
  protect,
  authorize("admin", "loan_officer", "ict_officer"),
  rejectLoanApplication
);

// Active loan routes
router.get(
  "/active",
  protect,
  authorize("admin", "loan_officer", "ict_officer"),
  getAllActiveLoans
);

router.get(
  "/active/:id",
  protect,
  authorize("admin", "loan_officer", "ict_officer"),
  getActiveLoanById
);

module.exports = router;