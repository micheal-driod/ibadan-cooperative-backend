const prisma = require("../config/prisma");

const lookupMemberByStaffNo = async (req, res) => {
  try {
    const { staff_no } = req.params;

    if (!staff_no) {
      return res.status(400).json({
        message: "staff_no is required.",
      });
    }

    const member = await prisma.member.findUnique({
      where: { staff_no: staff_no.trim() },
      select: {
        id: true,
        staff_no: true,
        first_name: true,
        middle_name: true,
        last_name: true,
        phone: true,
        grade_level: true,
        department: true,
        status: true,
      },
    });

    if (!member) {
      return res.status(404).json({
        message: "Member not found.",
      });
    }

    if (member.status !== "active") {
      return res.status(400).json({
        message: "Member is not active and cannot be used as guarantor.",
      });
    }

    const fullName =
      `${member.first_name}${member.middle_name ? " " + member.middle_name : ""} ${member.last_name}`.trim();

    return res.status(200).json({
      message: "Member found successfully",
      member: {
        id: member.id,
        staff_no: member.staff_no,
        full_name: fullName,
        phone: member.phone,
        grade_level: member.grade_level,
        department: member.department,
        status: member.status,
      },
    });
  } catch (error) {
    console.error("lookupMemberByStaffNo error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  lookupMemberByStaffNo,
};