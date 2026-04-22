const prisma = require("../config/prisma");

const postMonthlyLedgerEntry = async (req, res) => {
  try {
    const {
      member_id,
      loan_id,
      month,
      year,
      savings = 0,
      special_savings = 0,
      shares = 0,
      loan_collected = 0,
      loan_repayment = 0,
      loan_interest_deduction = 0,
      charges = 0,
      charges_label,
      fines = 0,
      fines_label,
      adjustment = 0,
      description,
    } = req.body;

    if (!member_id || !month || !year) {
      return res.status(400).json({
        message: "member_id, month, and year are required.",
      });
    }

    const member = await prisma.member.findUnique({
      where: { id: Number(member_id) },
      include: {
        savings_account: true,
        shares_account: true,
      },
    });

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    let selectedLoan = null;
    if (loan_id) {
      selectedLoan = await prisma.loan.findFirst({
        where: {
          id: Number(loan_id),
          member_id: Number(member_id),
          status: "active",
        },
      });

      if (!selectedLoan) {
        return res.status(404).json({
          message: "Selected active loan not found for this member.",
        });
      }
    }

    const entries = [];
    const numSavings = Number(savings);
    const numSpecialSavings = Number(special_savings);
    const numShares = Number(shares);
    const numLoanCollected = Number(loan_collected);
    const numLoanRepayment = Number(loan_repayment);
    const numLoanInterest = Number(loan_interest_deduction);
    const numCharges = Number(charges);
    const numFines = Number(fines);
    const numAdjustment = Number(adjustment);

    const result = await prisma.$transaction(async (tx) => {
      let savingsAccount = member.savings_account;
      let sharesAccount = member.shares_account;
      let updatedLoan = selectedLoan;

      if (!savingsAccount) {
        savingsAccount = await tx.savingsAccount.create({
          data: { member_id: Number(member_id) },
        });
      }

      if (!sharesAccount) {
        sharesAccount = await tx.sharesAccount.create({
          data: { member_id: Number(member_id) },
        });
      }

      if (numSavings > 0) {
        await tx.memberLedger.create({
          data: {
            member_id: Number(member_id),
            staff_user_id: req.user.id,
            entry_type: "SAVINGS",
            amount: numSavings,
            month: Number(month),
            year: Number(year),
            description: description || "Monthly savings posting",
          },
        });

        savingsAccount = await tx.savingsAccount.update({
          where: { member_id: Number(member_id) },
          data: {
            current_balance: { increment: numSavings },
            total_contributed: { increment: numSavings },
          },
        });

        entries.push({ type: "SAVINGS", amount: numSavings });
      }

      if (numSpecialSavings > 0) {
        await tx.memberLedger.create({
          data: {
            member_id: Number(member_id),
            staff_user_id: req.user.id,
            entry_type: "SPECIAL_SAVINGS",
            amount: numSpecialSavings,
            month: Number(month),
            year: Number(year),
            description: description || "Special savings posting",
          },
        });

        savingsAccount = await tx.savingsAccount.update({
          where: { member_id: Number(member_id) },
          data: {
            special_savings_balance: { increment: numSpecialSavings },
            total_special_contributed: { increment: numSpecialSavings },
          },
        });

        entries.push({ type: "SPECIAL_SAVINGS", amount: numSpecialSavings });
      }

      if (numShares > 0) {
        await tx.memberLedger.create({
          data: {
            member_id: Number(member_id),
            staff_user_id: req.user.id,
            entry_type: "SHARES",
            amount: numShares,
            month: Number(month),
            year: Number(year),
            description: description || "Monthly shares posting",
          },
        });

        sharesAccount = await tx.sharesAccount.update({
          where: { member_id: Number(member_id) },
          data: {
            current_balance: { increment: numShares },
            total_shares: { increment: numShares },
          },
        });

        entries.push({ type: "SHARES", amount: numShares });
      }

      if (numLoanCollected > 0) {
        await tx.memberLedger.create({
          data: {
            member_id: Number(member_id),
            staff_user_id: req.user.id,
            loan_id: updatedLoan ? updatedLoan.id : null,
            entry_type: "LOAN_COLLECTED",
            amount: numLoanCollected,
            month: Number(month),
            year: Number(year),
            description: description || "Loan collected posting",
          },
        });

        entries.push({ type: "LOAN_COLLECTED", amount: numLoanCollected });
      }

      if (numLoanRepayment > 0) {
        if (!updatedLoan) {
          throw new Error("Please select the specific active loan for loan repayment.");
        }

        if (numLoanRepayment > Number(updatedLoan.remaining_principal_balance)) {
          throw new Error("Loan repayment cannot be greater than remaining principal balance.");
        }

        await tx.memberLedger.create({
          data: {
            member_id: Number(member_id),
            staff_user_id: req.user.id,
            loan_id: updatedLoan.id,
            entry_type: "LOAN_REPAYMENT",
            amount: numLoanRepayment,
            month: Number(month),
            year: Number(year),
            description: description || "Loan principal repayment posting",
          },
        });

        updatedLoan = await tx.loan.update({
          where: { id: updatedLoan.id },
          data: {
            remaining_principal_balance: { decrement: numLoanRepayment },
            remaining_total_balance: { decrement: numLoanRepayment },
          },
        });

        entries.push({
          type: "LOAN_REPAYMENT",
          amount: numLoanRepayment,
          loan_id: updatedLoan.id,
        });
      }

      if (numLoanInterest > 0) {
        if (!updatedLoan) {
          throw new Error("Please select the specific active loan for interest deduction.");
        }

        if (numLoanInterest > Number(updatedLoan.remaining_interest_balance)) {
          throw new Error("Loan interest deduction cannot be greater than remaining interest balance.");
        }

        await tx.memberLedger.create({
          data: {
            member_id: Number(member_id),
            staff_user_id: req.user.id,
            loan_id: updatedLoan.id,
            entry_type: "LOAN_INTEREST_DEDUCTION",
            amount: numLoanInterest,
            month: Number(month),
            year: Number(year),
            description: description || "Loan interest deduction posting",
          },
        });

        updatedLoan = await tx.loan.update({
          where: { id: updatedLoan.id },
          data: {
            remaining_interest_balance: { decrement: numLoanInterest },
            remaining_total_balance: { decrement: numLoanInterest },
          },
        });

        entries.push({
          type: "LOAN_INTEREST_DEDUCTION",
          amount: numLoanInterest,
          loan_id: updatedLoan.id,
        });
      }

      if (numCharges > 0) {
        await tx.memberLedger.create({
          data: {
            member_id: Number(member_id),
            staff_user_id: req.user.id,
            loan_id: updatedLoan ? updatedLoan.id : null,
            entry_type: "CHARGES",
            entry_label: charges_label || "Charge",
            amount: numCharges,
            month: Number(month),
            year: Number(year),
            description: description || "Charge posting",
          },
        });

        entries.push({
          type: "CHARGES",
          label: charges_label || "Charge",
          amount: numCharges,
        });
      }

      if (numFines > 0) {
        await tx.memberLedger.create({
          data: {
            member_id: Number(member_id),
            staff_user_id: req.user.id,
            loan_id: updatedLoan ? updatedLoan.id : null,
            entry_type: "FINES",
            entry_label: fines_label || "Fine",
            amount: numFines,
            month: Number(month),
            year: Number(year),
            description: description || "Fine posting",
          },
        });

        entries.push({
          type: "FINES",
          label: fines_label || "Fine",
          amount: numFines,
        });
      }

      if (numAdjustment !== 0) {
        await tx.memberLedger.create({
          data: {
            member_id: Number(member_id),
            staff_user_id: req.user.id,
            loan_id: updatedLoan ? updatedLoan.id : null,
            entry_type: "ADJUSTMENT",
            amount: numAdjustment,
            month: Number(month),
            year: Number(year),
            description: description || "Adjustment posting",
          },
        });

        entries.push({ type: "ADJUSTMENT", amount: numAdjustment });
      }

      if (
        updatedLoan &&
        Number(updatedLoan.remaining_principal_balance) === 0 &&
        Number(updatedLoan.remaining_interest_balance) === 0 &&
        Number(updatedLoan.remaining_total_balance) === 0
      ) {
        updatedLoan = await tx.loan.update({
          where: { id: updatedLoan.id },
          data: { status: "completed" },
        });
      }

      return {
        savingsAccount,
        sharesAccount,
        selectedLoan: updatedLoan,
      };
    });

    const allActiveLoans = await prisma.loan.findMany({
      where: {
        member_id: Number(member_id),
        status: "active",
      },
    });

    const normalSavings = Number(result.savingsAccount?.current_balance || 0);
    const specialSavings = Number(result.savingsAccount?.special_savings_balance || 0);

    return res.status(201).json({
      message: "Monthly ledger entry posted successfully",
      entries,
      balances: {
        savings_balance: normalSavings,
        special_savings_balance: specialSavings,
        total_savings_balance: normalSavings + specialSavings,
        shares_balance: result.sharesAccount?.current_balance || 0,
        remaining_principal_balance: allActiveLoans.reduce(
          (sum, loan) => sum + Number(loan.remaining_principal_balance || 0),
          0
        ),
        remaining_interest_balance: allActiveLoans.reduce(
          (sum, loan) => sum + Number(loan.remaining_interest_balance || 0),
          0
        ),
        remaining_total_balance: allActiveLoans.reduce(
          (sum, loan) => sum + Number(loan.remaining_total_balance || 0),
          0
        ),
      },
    });
  } catch (error) {
    console.error("postMonthlyLedgerEntry error:", error);
    return res.status(400).json({ message: error.message || "Server error" });
  }
};

const getMemberLedger = async (req, res) => {
  try {
    const { memberId } = req.params;
    const targetMemberId = Number(memberId);

    if (req.user.role === "member" && req.user.id !== targetMemberId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const ledger = await prisma.memberLedger.findMany({
      where: {
        member_id: targetMemberId,
      },
      orderBy: {
        created_at: "desc",
      },
      include: {
        staff_user: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        loan: {
          include: {
            loan_type: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Member ledger retrieved successfully",
      count: ledger.length,
      ledger,
    });
  } catch (error) {
    console.error("getMemberLedger error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const getMemberFinancialSummary = async (req, res) => {
  try {
    const { memberId } = req.params;

    const member = await prisma.member.findUnique({
      where: { id: Number(memberId) },
      include: {
        savings_account: true,
        shares_account: true,
        loans: {
          where: { status: "active" },
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    const normalSavings = Number(member.savings_account?.current_balance || 0);
    const specialSavings = Number(member.savings_account?.special_savings_balance || 0);

    return res.status(200).json({
      message: "Member financial summary retrieved successfully",
      summary: {
        member_id: member.id,
        staff_no: member.staff_no,
        full_name: `${member.first_name} ${member.middle_name ? member.middle_name + " " : ""}${member.last_name}`,
        savings_balance: normalSavings,
        special_savings_balance: specialSavings,
        total_savings_balance: normalSavings + specialSavings,
        shares_balance: member.shares_account?.current_balance || 0,
        remaining_principal_balance: member.loans.reduce(
          (sum, loan) => sum + Number(loan.remaining_principal_balance || 0),
          0
        ),
        remaining_interest_balance: member.loans.reduce(
          (sum, loan) => sum + Number(loan.remaining_interest_balance || 0),
          0
        ),
        remaining_total_balance: member.loans.reduce(
          (sum, loan) => sum + Number(loan.remaining_total_balance || 0),
          0
        ),
      },
    });
  } catch (error) {
    console.error("getMemberFinancialSummary error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  postMonthlyLedgerEntry,
  getMemberLedger,
  getMemberFinancialSummary,
};