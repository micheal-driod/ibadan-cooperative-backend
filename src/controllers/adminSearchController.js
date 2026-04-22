const prisma = require("../config/prisma");

const searchMembers = async (req, res) => {
  try {
    const { q } = req.query;

    const search = (q || "").trim();

    if (!search) {
      return res.status(200).json({
        message: "No search term provided",
        members: [],
      });
    }

    const members = await prisma.member.findMany({
      where: {
        OR: [
          { staff_no: { contains: search, mode: "insensitive" } },
          { first_name: { contains: search, mode: "insensitive" } },
          { middle_name: { contains: search, mode: "insensitive" } },
          { last_name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      },
      orderBy: {
        created_at: "desc",
      },
      take: 20,
      include: {
        savings_account: true,
        shares_account: true,
      },
    });

    return res.status(200).json({
      message: "Members retrieved successfully",
      count: members.length,
      members,
    });
  } catch (error) {
    console.error("searchMembers error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

const getMemberActiveLoans = async (req, res) => {
  try {
    const { memberId } = req.params;

    const member = await prisma.member.findUnique({
      where: { id: Number(memberId) },
      select: {
        id: true,
        staff_no: true,
        first_name: true,
        middle_name: true,
        last_name: true,
      },
    });

    if (!member) {
      return res.status(404).json({
        message: "Member not found",
      });
    }

    const loans = await prisma.loan.findMany({
      where: {
        member_id: Number(memberId),
        status: "active",
      },
      include: {
        loan_type: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return res.status(200).json({
      message: "Active loans retrieved successfully",
      member,
      count: loans.length,
      loans,
    });
  } catch (error) {
    console.error("getMemberActiveLoans error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

module.exports = {
  searchMembers,
  getMemberActiveLoans,
};