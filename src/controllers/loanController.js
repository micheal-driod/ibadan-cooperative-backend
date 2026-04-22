const prisma = require("../config/prisma");

const calculateLoanTerms = (loanType, amount, selectedDuration = null) => {
  const name = loanType.name;
  const interestRate = Number(loanType.interest_rate);

  let durationMonths;

  if (name === "long_term_loan") {
    if (
      selectedDuration === null ||
      selectedDuration === undefined ||
      selectedDuration === ""
    ) {
      throw new Error("Duration is required for long-term loan.");
    }

    const duration = Number(selectedDuration);

    if (Number.isNaN(duration)) {
      throw new Error("Invalid duration value.");
    }

    if (
      duration < Number(loanType.min_duration_months) ||
      duration > Number(loanType.max_duration_months)
    ) {
      throw new Error(
        `Long-term loan duration must be between ${loanType.min_duration_months} and ${loanType.max_duration_months} months.`
      );
    }

    durationMonths = duration;
  } else {
    durationMonths = Number(loanType.max_duration_months);
  }

  if (!durationMonths || Number.isNaN(durationMonths)) {
    throw new Error("Unable to determine loan duration.");
  }

  let interestAmount = 0;

  if (
    name === "soft_loan" ||
    name === "commodity_loan" ||
    name === "long_term_loan"
  ) {
    interestAmount = (amount * interestRate) / 100;
  } else {
    throw new Error("Unsupported loan type.");
  }

  const totalRepayment = amount + interestAmount;
  const monthlyDeduction = totalRepayment / durationMonths;

  if (Number.isNaN(monthlyDeduction)) {
    throw new Error("Monthly deduction calculation failed.");
  }

  return {
    interestRate,
    durationMonths,
    interestAmount,
    totalRepayment,
    monthlyDeduction,
  };
};

const applyForLoan = async (req, res) => {
  try {
    if (!req.user || req.user.type !== "member") {
      return res.status(403).json({ message: "Only members can apply for loans" });
    }

    const memberId = req.user.id;

    const {
      loan_type_id,
      requested_amount,
      loan_purpose,
      duration_months,
      guarantor_1,
      guarantor_2,
    } = req.body;

    if (!loan_type_id || !requested_amount || !loan_purpose) {
      return res.status(400).json({
        message: "Please select a loan type and enter requested amount and purpose.",
      });
    }

    if (
      !guarantor_1 ||
      !guarantor_1.staff_no ||
      !guarantor_2 ||
      !guarantor_2.staff_no
    ) {
      return res.status(400).json({
        message: "Both guarantor staff numbers are required.",
      });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    const loanType = await prisma.loanType.findUnique({
      where: { id: Number(loan_type_id) },
    });

    if (!loanType || !loanType.is_active) {
      return res.status(404).json({ message: "Invalid or inactive loan type" });
    }

    const amount = Number(requested_amount);

    if (Number.isNaN(amount)) {
      return res.status(400).json({ message: "Invalid requested amount." });
    }

    if (loanType.min_amount && amount < Number(loanType.min_amount)) {
      return res.status(400).json({
        message: `Minimum amount for this loan is ${loanType.min_amount}`,
      });
    }

    if (loanType.max_amount && amount > Number(loanType.max_amount)) {
      return res.status(400).json({
        message: `Maximum amount for this loan is ${loanType.max_amount}`,
      });
    }

    const guarantor1Member = await prisma.member.findUnique({
      where: { staff_no: guarantor_1.staff_no.trim() },
    });

    const guarantor2Member = await prisma.member.findUnique({
      where: { staff_no: guarantor_2.staff_no.trim() },
    });

    if (!guarantor1Member || !guarantor2Member) {
      return res.status(400).json({
        message: "Both guarantors must be valid registered members.",
      });
    }

    if (guarantor1Member.id === member.id || guarantor2Member.id === member.id) {
      return res.status(400).json({
        message: "Applicant cannot be used as a guarantor.",
      });
    }

    if (guarantor1Member.id === guarantor2Member.id) {
      return res.status(400).json({
        message: "Guarantor 1 and Guarantor 2 must be different members.",
      });
    }

    let calculation;

    try {
      calculation = calculateLoanTerms(loanType, amount, duration_months);
    } catch (calcError) {
      return res.status(400).json({ message: calcError.message });
    }

    const guarantor1FullName = `${guarantor1Member.first_name}${
      guarantor1Member.middle_name ? " " + guarantor1Member.middle_name : ""
    } ${guarantor1Member.last_name}`.trim();

    const guarantor2FullName = `${guarantor2Member.first_name}${
      guarantor2Member.middle_name ? " " + guarantor2Member.middle_name : ""
    } ${guarantor2Member.last_name}`.trim();

    if (
      !member.grade_level ||
      !member.bank_name ||
      !member.account_name ||
      !member.account_number
    ) {
      return res.status(400).json({
        message:
          "Please complete your profile and bank account details before applying for a loan.",
      });
    }

    const loanApplication = await prisma.loanApplication.create({
      data: {
        member_id: member.id,
        loan_type_id: loanType.id,
        requested_amount: amount,
        interest_rate: calculation.interestRate,
        duration_months: calculation.durationMonths,
        interest_amount: calculation.interestAmount,
        total_repayment: calculation.totalRepayment,
        monthly_deduction: calculation.monthlyDeduction,
        loan_purpose,
        guarantors: {
          create: [
            {
              guarantor_no: 1,
              full_name: guarantor1FullName,
              staff_no: guarantor1Member.staff_no,
              phone: guarantor1Member.phone || "",
              grade_level: guarantor1Member.grade_level || "",
            },
            {
              guarantor_no: 2,
              full_name: guarantor2FullName,
              staff_no: guarantor2Member.staff_no,
              phone: guarantor2Member.phone || "",
              grade_level: guarantor2Member.grade_level || "",
            },
          ],
        },
      },
      include: {
        loan_type: true,
        guarantors: true,
      },
    });

    return res.status(201).json({
      message: "Loan application submitted successfully",
      application: loanApplication,
    });
  } catch (error) {
    console.error("applyForLoan error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const getAllLoanApplications = async (req, res) => {
  try {
    const applications = await prisma.loanApplication.findMany({
      orderBy: {
        created_at: "desc",
      },
      include: {
        member: {
          select: {
            id: true,
            staff_no: true,
            first_name: true,
            middle_name: true,
            last_name: true,
            phone: true,
            email: true,
            department: true,
            grade_level: true,
            address: true,
            bank_name: true,
            account_name: true,
            account_number: true,
          },
        },
        loan_type: true,
        guarantors: true,
        loan: true,
      },
    });

    return res.status(200).json({
      message: "Loan applications retrieved successfully",
      count: applications.length,
      applications,
    });
  } catch (error) {
    console.error("getAllLoanApplications error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const getLoanApplicationById = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await prisma.loanApplication.findUnique({
      where: { id: Number(id) },
      include: {
        member: {
          select: {
            id: true,
            staff_no: true,
            first_name: true,
            middle_name: true,
            last_name: true,
            phone: true,
            email: true,
            department: true,
            grade_level: true,
            address: true,
            employment_status: true,
            bank_name: true,
            account_name: true,
            account_number: true,
          },
        },
        loan_type: true,
        guarantors: true,
        loan: true,
      },
    });

    if (!application) {
      return res.status(404).json({ message: "Loan application not found" });
    }

    return res.status(200).json({
      message: "Loan application retrieved successfully",
      application,
    });
  } catch (error) {
    console.error("getLoanApplicationById error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const getAllActiveLoans = async (req, res) => {
  try {
    const loans = await prisma.loan.findMany({
      orderBy: {
        created_at: "desc",
      },
      include: {
        member: {
          select: {
            id: true,
            staff_no: true,
            first_name: true,
            middle_name: true,
            last_name: true,
            department: true,
            grade_level: true,
          },
        },
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
    return res.status(500).json({ message: "Server error" });
  }
};

const getActiveLoanById = async (req, res) => {
  try {
    const { id } = req.params;

    const loan = await prisma.loan.findUnique({
      where: { id: Number(id) },
      include: {
        member: true,
        loan_type: true,
        loan_application: {
          include: {
            guarantors: true,
          },
        },
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
    return res.status(500).json({ message: "Server error" });
  }
};

const markLoanAsViewed = async (req, res) => {
  try {
    const { id } = req.params;

    const existingApplication = await prisma.loanApplication.findUnique({
      where: { id: Number(id) },
    });

    if (!existingApplication) {
      return res.status(404).json({ message: "Loan application not found" });
    }

    const updatedApplication = await prisma.loanApplication.update({
      where: { id: Number(id) },
      data: {
        status: "viewed",
        viewed_at: new Date(),
        reviewed_by: req.user.id,
      },
    });

    return res.status(200).json({
      message: "Loan application marked as viewed",
      application: updatedApplication,
    });
  } catch (error) {
    console.error("markLoanAsViewed error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const approveLoanApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { review_note } = req.body;

    const existingApplication = await prisma.loanApplication.findUnique({
      where: { id: Number(id) },
      include: {
        member: true,
        loan_type: true,
        guarantors: true,
        loan: true,
      },
    });

    if (!existingApplication) {
      return res.status(404).json({ message: "Loan application not found" });
    }

    if (existingApplication.loan) {
      return res.status(400).json({
        message: "An active loan has already been created for this application",
      });
    }

    if (existingApplication.status === "approved") {
      return res.status(400).json({ message: "Loan application is already approved" });
    }

    if (existingApplication.status === "rejected") {
      return res.status(400).json({ message: "Rejected application cannot be approved directly" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedApplication = await tx.loanApplication.update({
        where: { id: Number(id) },
        data: {
          status: "approved",
          review_note: review_note || "Loan application approved",
          reviewed_by: req.user.id,
          reviewed_at: new Date(),
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

      return { updatedApplication, activeLoan };
    });

    return res.status(200).json({
      message: "Loan application approved and active loan created successfully",
      application: result.updatedApplication,
      active_loan: result.activeLoan,
    });
  } catch (error) {
    console.error("approveLoanApplication error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const rejectLoanApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason, review_note } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({
        message: "Rejection reason is required.",
      });
    }

    const existingApplication = await prisma.loanApplication.findUnique({
      where: { id: Number(id) },
      include: {
        member: true,
        loan_type: true,
        guarantors: true,
      },
    });

    if (!existingApplication) {
      return res.status(404).json({ message: "Loan application not found" });
    }

    if (existingApplication.status === "approved") {
      return res.status(400).json({ message: "Approved application cannot be rejected directly" });
    }

    if (existingApplication.status === "rejected") {
      return res.status(400).json({ message: "Loan application is already rejected" });
    }

    const updatedApplication = await prisma.loanApplication.update({
      where: { id: Number(id) },
      data: {
        status: "rejected",
        rejection_reason,
        review_note: review_note || "Loan application rejected",
        reviewed_by: req.user.id,
        reviewed_at: new Date(),
      },
      include: {
        member: true,
        loan_type: true,
        guarantors: true,
      },
    });

    return res.status(200).json({
      message: "Loan application rejected successfully",
      application: updatedApplication,
    });
  } catch (error) {
    console.error("rejectLoanApplication error:", error);
    return res.status(500).json({ message: "Server error" });
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