const prisma = require("../config/prisma");

// MEMBER: Apply for loan
const applyForLoan = async (req, res) => {
  try {
    const memberId = req.user.id;

    const {
      loan_type_id,
      loanTypeId,
      requested_amount,
      amount,
      duration_months,
      loan_purpose,
      purpose,
    } = req.body;

    const finalLoanTypeId = Number(loan_type_id || loanTypeId);
    const finalAmount = Number(requested_amount || amount);
    const rawDuration = duration_months;
let finalDuration = rawDuration ? Number(rawDuration) : null;
    const finalPurpose = loan_purpose || purpose;

    if (!finalLoanTypeId || !finalAmount || !finalPurpose) {
  return res.status(400).json({
    message: "loan_type_id, requested_amount and loan_purpose are required",
  });
}
if (!finalDuration) {
  finalDuration = Number(loanType.max_duration_months);
}

    const loanType = await prisma.loanType.findUnique({
      where: { id: finalLoanTypeId },
    });

    if (!loanType || loanType.is_active === false) {
      return res.status(400).json({
        message: "Loan type is unsupported or inactive",
      });
    }

    if (
      finalDuration < loanType.min_duration_months ||
      finalDuration > loanType.max_duration_months
    ) {
      return res.status(400).json({
        message: `Invalid duration. ${loanType.name} must be between ${loanType.min_duration_months} and ${loanType.max_duration_months} months.`,
      });
    }

    if (loanType.min_amount && finalAmount < Number(loanType.min_amount)) {
      return res.status(400).json({
        message: `Minimum amount is ${loanType.min_amount}`,
      });
    }

    if (loanType.max_amount && finalAmount > Number(loanType.max_amount)) {
      return res.status(400).json({
        message: `Maximum amount is ${loanType.max_amount}`,
      });
    }

    const interestRate = Number(loanType.interest_rate);
    const interestAmount = (finalAmount * interestRate) / 100;
    const totalRepayment = finalAmount + interestAmount;
    const monthlyDeduction = totalRepayment / finalDuration;

    const loanApplication = await prisma.loanApplication.create({
      data: {
        member_id: memberId,
        loan_type_id: finalLoanTypeId,
        requested_amount: finalAmount,
        interest_rate: interestRate,
        duration_months: finalDuration,
        interest_amount: interestAmount,
        total_repayment: totalRepayment,
        monthly_deduction: monthlyDeduction,
        loan_purpose: finalPurpose,
        status: "submitted",
      },
      include: {
        loan_type: true,
        member: true,
      },
    });

    return res.status(201).json({
      message: "Loan application submitted successfully",
      loanApplication,
    });
  } catch (error) {
    console.error("applyForLoan error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

// ADMIN: Get all loan applications
const getAllLoanApplications = async (req, res) => {
  try {
    const loans = await prisma.loanApplication.findMany({
      include: {
        loan_type: true,
        member: true,
      },
      orderBy: { created_at: "desc" },
    });

    res.status(200).json(loans);
  } catch (error) {
    console.error("getAllLoanApplications error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ADMIN: Get single loan application
const getLoanApplicationById = async (req, res) => {
  try {
    const loanId = Number(req.params.id);

    const loan = await prisma.loanApplication.findUnique({
      where: { id: loanId },
      include: {
        loan_type: true,
        member: true,
      },
    });

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    res.status(200).json(loan);
  } catch (error) {
    console.error("getLoanApplicationById error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ADMIN: Mark as viewed
const markLoanAsViewed = async (req, res) => {
  try {
    const loanId = Number(req.params.id);

    const loan = await prisma.loanApplication.update({
      where: { id: loanId },
      data: { viewed_at: new Date() },
    });

    res.status(200).json({
      message: "Loan marked as viewed",
      loan,
    });
  } catch (error) {
    console.error("markLoanAsViewed error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ADMIN: Approve
const approveLoanApplication = async (req, res) => {
  try {
    const loanId = Number(req.params.id);

    const loan = await prisma.loanApplication.update({
      where: { id: loanId },
      data: {
        status: "approved",
        reviewed_by: req.user.id,
        reviewed_at: new Date(),
      },
    });

    res.status(200).json({
      message: "Loan approved successfully",
      loan,
    });
  } catch (error) {
    console.error("approveLoanApplication error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ADMIN: Reject
const rejectLoanApplication = async (req, res) => {
  try {
    const loanId = Number(req.params.id);
    const { rejection_reason } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({
        message: "Rejection reason is required",
      });
    }

    const loan = await prisma.loanApplication.update({
      where: { id: loanId },
      data: {
        status: "rejected",
        rejection_reason,
        reviewed_by: req.user.id,
        reviewed_at: new Date(),
      },
    });

    res.status(200).json({
      message: "Loan rejected successfully",
      loan,
    });
  } catch (error) {
    console.error("rejectLoanApplication error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ACTIVE LOANS (placeholder for now)
const getAllActiveLoans = async (req, res) => {
  res.status(200).json({
    message: "Active loans feature coming next",
  });
};

const getActiveLoanById = async (req, res) => {
  res.status(200).json({
    message: "Active loan detail coming next",
  });
};

module.exports = {
  applyForLoan,
  getAllLoanApplications,
  getLoanApplicationById,
  getAllActiveLoans,
  getActiveLoanById,
  markLoanAsViewed,
  approveLoanApplication,
  rejectLoanApplication,
};