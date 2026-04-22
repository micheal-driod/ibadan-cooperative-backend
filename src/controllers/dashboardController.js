const prisma = require("../config/prisma");

const getMemberDashboard = async (req, res) => {
  try {
    if (!req.user || req.user.type !== "member") {
      return res.status(403).json({ message: "Only members can access this dashboard" });
    }

    const memberId = req.user.id;

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        savings_account: true,
        shares_account: true,
        loans: {
          where: { status: "active" },
          include: {
            loan_type: true,
          },
          orderBy: {
            created_at: "desc",
          },
        },
      },
    });

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    const recentLedger = await prisma.memberLedger.findMany({
      where: { member_id: memberId },
      orderBy: { created_at: "desc" },
      take: 5,
    });

    const normalSavings = Number(member.savings_account?.current_balance || 0);
    const specialSavings = Number(member.savings_account?.special_savings_balance || 0);

    const totalPrincipalBalance = member.loans.reduce(
      (sum, loan) => sum + Number(loan.remaining_principal_balance || 0),
      0
    );

    const totalInterestBalance = member.loans.reduce(
      (sum, loan) => sum + Number(loan.remaining_interest_balance || 0),
      0
    );

    const totalLoanBalance = member.loans.reduce(
      (sum, loan) => sum + Number(loan.remaining_total_balance || 0),
      0
    );

    const activeLoans = member.loans.map((loan) => ({
      id: loan.id,
      loan_type: loan.loan_type.name,
      principal_amount: loan.principal_amount,
      interest_amount: loan.interest_amount,
      total_payable: loan.total_payable,
      monthly_deduction: loan.monthly_deduction,
      duration_months: loan.duration_months,
      remaining_principal_balance: loan.remaining_principal_balance,
      remaining_interest_balance: loan.remaining_interest_balance,
      remaining_total_balance: loan.remaining_total_balance,
      status: loan.status,
      approved_at: loan.approved_at,
    }));

    return res.status(200).json({
      message: "Member dashboard retrieved successfully",
      dashboard: {
        member: {
          id: member.id,
          staff_no: member.staff_no,
          first_name: member.first_name,
          middle_name: member.middle_name,
          last_name: member.last_name,
          full_name: `${member.first_name} ${member.middle_name ? member.middle_name + " " : ""}${member.last_name}`,
          phone: member.phone,
          email: member.email,
          department: member.department,
          grade_level: member.grade_level,
          status: member.status,
        },
        balances: {
          savings_balance: normalSavings,
          special_savings_balance: specialSavings,
          total_savings_balance: normalSavings + specialSavings,
          shares_balance: member.shares_account?.current_balance || 0,
        },
        loan_totals: {
          remaining_principal_balance: totalPrincipalBalance,
          remaining_interest_balance: totalInterestBalance,
          remaining_total_balance: totalLoanBalance,
        },
        active_loans: activeLoans,
        recent_ledger: recentLedger,
      },
    });
  } catch (error) {
    console.error("getMemberDashboard error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getMemberDashboard,
};