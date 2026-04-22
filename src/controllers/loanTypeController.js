const prisma = require("../config/prisma");

const getLoanTypes = async (req, res) => {
  try {
    const loanTypes = await prisma.loanType.findMany({
      where: {
        is_active: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    return res.status(200).json({
      message: "Loan types retrieved successfully",
      loan_types: loanTypes,
    });
  } catch (error) {
    console.error("getLoanTypes error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getLoanTypes,
};