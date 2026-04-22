const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");

const submitPasswordChangeRequest = async (req, res) => {
  try {
    if (!req.user || req.user.type !== "member") {
      return res.status(403).json({
        message: "Only members can submit password change requests",
      });
    }

    const memberId = req.user.id;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        message: "Current password and new password are required",
      });
    }

    if (String(new_password).trim().length < 4) {
      return res.status(400).json({
        message: "New password must be at least 4 characters",
      });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        user_account: true,
      },
    });

    if (!member || !member.user_account) {
      return res.status(404).json({
        message: "Member account not found",
      });
    }

    const isCurrentPasswordCorrect = await bcrypt.compare(
      String(current_password),
      member.user_account.password_hash
    );

    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        message: "Current password is incorrect",
      });
    }

    const existingPendingRequest = await prisma.passwordChangeRequest.findFirst({
      where: {
        member_id: memberId,
        status: "pending",
      },
    });

    if (existingPendingRequest) {
      return res.status(400).json({
        message: "You already have a pending password change request",
      });
    }

    const cleanNewPassword = String(new_password).trim();
    const newPasswordHash = await bcrypt.hash(cleanNewPassword, 10);

    const request = await prisma.passwordChangeRequest.create({
      data: {
        member_id: memberId,
        current_password: String(current_password),
        new_password_hash: newPasswordHash,
        new_password_plain: cleanNewPassword,
      },
    });

    return res.status(201).json({
      message: "Password change request submitted successfully",
      request,
    });
  } catch (error) {
    console.error("submitPasswordChangeRequest error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

const getMyPasswordChangeRequests = async (req, res) => {
  try {
    if (!req.user || req.user.type !== "member") {
      return res.status(403).json({
        message: "Only members can access password change requests",
      });
    }

    const memberId = req.user.id;

    const requests = await prisma.passwordChangeRequest.findMany({
      where: {
        member_id: memberId,
      },
      orderBy: {
        created_at: "desc",
      },
      include: {
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
    console.error("getMyPasswordChangeRequests error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

module.exports = {
  submitPasswordChangeRequest,
  getMyPasswordChangeRequests,
};