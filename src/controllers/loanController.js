const prisma = require("../config/prisma");

const getLoanBucketType = (loanTypeName = "") => {
  const name = String(loanTypeName).toLowerCase();

  if (name.includes("long")) return "LONG_TERM";
  if (name.includes("soft")) return "SOFT";
  if (name.includes("commodity")) return "COMMODITY";

  throw new Error("Unsupported loan type for balance tracking");
};

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
    let finalDuration = duration_months ? Number(duration_months) : null;
    const finalPurpose = loan_purpose || purpose;

    if (!finalLoanTypeId || !finalAmount || !finalPurpose) {
      return res.status(400).json({
        message: "loan_type_id, requested_amount and loan_purpose are required",
      });
    }

    const loanType = await prisma.loanType.findUnique({
      where: { id: finalLoanTypeId },
    });

    if (!loanType || loanType.is_active === false) {
      return res.status(400).json({
        message: "Loan type is unsupported or inactive",
      });
    }

    if (!finalDuration) {
      finalDuration = Number(loanType.max_duration_months);
    }

    if (
      finalDuration < Number(loanType.min_duration_months) ||
      finalDuration > Number(loanType.max_duration_months)
    ) {
      return res.status(400).json({
        message: `Invalid duration. ${loanType.name} must be between ${loanType.min_duration_months} and ${loanType.max_duration_months} months.`,
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
      application: loanApplication,
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
        loan: true,
        guarantors: true,
      },
      orderBy: { created_at: "desc" },
    });

    return res.status(200).json({
      message: "Loan applications retrieved successfully",
      count: loans.length,
      applications: loans,
      loans,
    });
  } catch (error) {
    console.error("getAllLoanApplications error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
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
        loan: true,
        guarantors: true,
      },
    });

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    return res.status(200).json({
      message: "Loan application retrieved successfully",
      application: loan,
      loan,
    });
  } catch (error) {
    console.error("getLoanApplicationById error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// ADMIN: Mark as viewed
const markLoanAsViewed = async (req, res) => {
  try {
    const loanId = Number(req.params.id);

    const existingLoan = await prisma.loanApplication.findUnique({
      where: { id: loanId },
    });

    if (!existingLoan) {
      return res.status(404).json({ message: "Loan application not found" });
    }

    const loan = await prisma.loanApplication.update({
      where: { id: loanId },
      data: {
        status: existingLoan.status === "submitted" ? "viewed" : existingLoan.status,
        viewed_at: new Date(),
        reviewed_by: req.user.id,
      },
      include: {
        loan_type: true,
        member: true,
        loan: true,
        guarantors: true,
      },
    });

    return res.status(200).json({
      message: "Loan marked as viewed",
      application: loan,
      loan,
    });
  } catch (error) {
    console.error("markLoanAsViewed error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// ADMIN: Approve
const approveLoanApplication = async (req, res) => {
  try {
    const loanId = Number(req.params.id);

    const existingApplication = await prisma.loanApplication.findUnique({
      where: { id: loanId },
      include: {
        loan_type: true,
        member: true,
        loan: true,
      },
    });

    if (!existingApplication) {
      return res.status(404).json({ message: "Loan application not found" });
    }

    if (existingApplication.loan) {
      return res.status(400).json({
        message: "Active loan has already been created for this application",
      });
    }

    if (existingApplication.status === "approved") {
      return res.status(400).json({
        message: "Loan application is already approved",
      });
    }

    if (existingApplication.status === "rejected") {
      return res.status(400).json({
        message: "Rejected loan application cannot be approved",
      });
    }

    const bucketType = getLoanBucketType(existingApplication.loan_type.name);

    const result = await prisma.$transaction(async (tx) => {
      const approvedApplication = await tx.loanApplication.update({
        where: { id: loanId },
        data: {
          status: "approved",
          reviewed_by: req.user.id,
          reviewed_at: new Date(),
        },
        include: {
          loan_type: true,
          member: true,
        },
      });

      const activeLoan = await tx.loan.create({
        data: {
          member_id: existingApplication.member_id,
          loan_application_id: existingApplication.id,
          loan_type_id: existingApplication.loan_type_id,
          principal_amount: existingApplication.requested_amount,
          interest_amount: existingApplication.interest_amount,
          total_payable: existingApplication.total_repayment,
          monthly_deduction: existingApplication.monthly_deduction,
          duration_months: existingApplication.duration_months,
          remaining_principal_balance: existingApplication.requested_amount,
          remaining_interest_balance: existingApplication.interest_amount,
          remaining_total_balance: existingApplication.total_repayment,
          status: "active",
          approved_by: req.user.id,
          approved_at: new Date(),
        },
      });

      const loanBalance = await tx.memberLoanBalance.upsert({
        where: {
          member_id_loan_bucket_type: {
            member_id: existingApplication.member_id,
            loan_bucket_type: bucketType,
          },
        },
        update: {
            principal_balance: { increment: existingApplication.requested_amount },
            interest_balance: { increment: existingApplication.interest_amount },
            total_balance: { increment: existingApplication.total_repayment },
            last_updated_by: req.user.id,
},
        create: {
          member_id: existingApplication.member_id,
          loan_bucket_type: bucketType,
          principal_balance: existingApplication.requested_amount,
          interest_balance: existingApplication.interest_amount,
          total_balance: existingApplication.total_repayment,
          last_updated_by: req.user.id,
        },
      });

      return { approvedApplication, activeLoan, loanBalance };
    });

    return res.status(200).json({
      message: "Loan approved, active loan created, and loan balance updated successfully",
      application: result.approvedApplication,
      loan: result.approvedApplication,
      active_loan: result.activeLoan,
      loan_balance: result.loanBalance,
    });
  } catch (error) {
    console.error("approveLoanApplication error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
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

    const existingLoan = await prisma.loanApplication.findUnique({
      where: { id: loanId },
    });

    if (!existingLoan) {
      return res.status(404).json({ message: "Loan application not found" });
    }

    if (existingLoan.status === "approved") {
      return res.status(400).json({
        message: "Approved loan application cannot be rejected",
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
      include: {
        loan_type: true,
        member: true,
        loan: true,
        guarantors: true,
      },
    });

    return res.status(200).json({
      message: "Loan rejected successfully",
      application: loan,
      loan,
    });
  } catch (error) {
    console.error("rejectLoanApplication error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// ACTIVE LOANS
const getAllActiveLoans = async (req, res) => {
  try {
    const loans = await prisma.loan.findMany({
      orderBy: { created_at: "desc" },
      include: {
        member: true,
        loan_type: true,
        loan_application: true,
        approver: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Active loans retrieved successfully",
      count: loans.length,
      loans,
    });
  } catch (error) {
    console.error("getAllActiveLoans error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

const getActiveLoanById = async (req, res) => {
  try {
    const loanId = Number(req.params.id);

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        member: true,
        loan_type: true,
        loan_application: true,
        approver: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
    });

    if (!loan) {
      return res.status(404).json({ message: "Active loan not found" });
    }

    return res.status(200).json({
      message: "Active loan retrieved successfully",
      loan,
    });
  } catch (error) {
    console.error("getActiveLoanById error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
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