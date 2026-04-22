const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");

const buildFullName = (firstName, middleName, lastName) => {
  return `${firstName || ""}${middleName ? ` ${middleName}` : ""} ${lastName || ""}`
    .replace(/\s+/g, " ")
    .trim();
};

const getAllPasswordChangeRequests = async (req, res) => {
  try {
    const requests = await prisma.passwordChangeRequest.findMany({
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
        reviewer: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Password change requests retrieved successfully",
      count: requests.length,
      requests,
    });
  } catch (error) {
    console.error("getAllPasswordChangeRequests error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

const approvePasswordChangeRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_note } = req.body;

    const request = await prisma.passwordChangeRequest.findUnique({
      where: { id: Number(id) },
      include: {
        member: {
          include: {
            user_account: true,
          },
        },
      },
    });

    if (!request) {
      return res.status(404).json({
        message: "Password change request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        message: "Only pending requests can be approved",
      });
    }

    const finalPassword = request.new_password_plain;

    if (!finalPassword || !String(finalPassword).trim()) {
      return res.status(400).json({
        message:
          "Plain password not found on this request. Ensure member submit flow stores new_password_plain.",
      });
    }

    const cleanPassword = String(finalPassword).trim();
    const newPasswordHash = await bcrypt.hash(cleanPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      await tx.userAccount.update({
        where: { member_id: request.member_id },
        data: {
          password_hash: newPasswordHash,
          must_change_password: false,
        },
      });

      await tx.memberCredentialLog.create({
        data: {
          member_id: request.member.id,
          staff_no: request.member.staff_no,
          full_name: buildFullName(
            request.member.first_name,
            request.member.middle_name,
            request.member.last_name
          ),
          credential_type: "RESET",
          plain_password: cleanPassword,
          generated_by: req.user.id,
        },
      });

      const updatedRequest = await tx.passwordChangeRequest.update({
        where: { id: request.id },
        data: {
          status: "approved",
          admin_note: admin_note || "Password change approved",
          reviewed_by: req.user.id,
          reviewed_at: new Date(),
        },
      });

      return updatedRequest;
    });

    return res.status(200).json({
      message: "Password change request approved successfully",
      credential: {
        staff_no: request.member.staff_no,
        full_name: buildFullName(
          request.member.first_name,
          request.member.middle_name,
          request.member.last_name
        ),
        new_password: cleanPassword,
      },
      request: result,
    });
  } catch (error) {
    console.error("approvePasswordChangeRequest error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

const rejectPasswordChangeRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_note } = req.body;

    const request = await prisma.passwordChangeRequest.findUnique({
      where: { id: Number(id) },
    });

    if (!request) {
      return res.status(404).json({
        message: "Password change request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        message: "Only pending requests can be rejected",
      });
    }

    const updatedRequest = await prisma.passwordChangeRequest.update({
      where: { id: Number(id) },
      data: {
        status: "rejected",
        admin_note: admin_note || "Password change request rejected",
        reviewed_by: req.user.id,
        reviewed_at: new Date(),
      },
    });

    return res.status(200).json({
      message: "Password change request rejected successfully",
      request: updatedRequest,
    });
  } catch (error) {
    console.error("rejectPasswordChangeRequest error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

module.exports = {
  getAllPasswordChangeRequests,
  approvePasswordChangeRequest,
  rejectPasswordChangeRequest,
};