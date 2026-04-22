const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");

const normalizeDepartment = (department) => {
  if (!department) return null;

  const value = department.trim().toUpperCase();

  const map = {
    ARFFS: "ARFFS",
    AVSEC: "AVSEC",
    COMMERCIAL: "COMMERCIAL",
    STORE: "STORE",
    ENVIRONMENT: "ENVIRONMENT",
    ICT: "ICT",
    ACCOUNTS: "ACCOUNTS",
    AUDIT: "AUDIT",
    CREDIT_CONTROL: "CREDIT_CONTROL",
    "CREDIT CONTROL": "CREDIT_CONTROL",
    SAFETY: "SAFETY",
    OTHERS: "OTHERS",
  };

  return map[value] || null;
};

const getMyProfile = async (req, res) => {
  try {
    if (!req.user || req.user.type !== "member") {
      return res.status(403).json({ message: "Only members can access this profile" });
    }

    const member = await prisma.member.findUnique({
      where: { id: req.user.id },
      include: {
        user_account: {
          select: {
            username: true,
            must_change_password: true,
            is_active: true,
            last_login: true,
          },
        },
      },
    });

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    return res.status(200).json({
      message: "Profile retrieved successfully",
      profile: {
        id: member.id,
        staff_no: member.staff_no,
        membership_no: member.membership_no,
        first_name: member.first_name,
        middle_name: member.middle_name,
        last_name: member.last_name,
        full_name: `${member.first_name}${member.middle_name ? " " + member.middle_name : ""} ${member.last_name}`.trim(),
        phone: member.phone,
        email: member.email,
        department: member.department,
        address: member.address,
        employment_status: member.employment_status,
        grade_level: member.grade_level,
        purpose: member.purpose,
        date_joined: member.date_joined,
        status: member.status,
        bank_name: member.bank_name,
        account_name: member.account_name,
        account_number: member.account_number,
        username: member.user_account?.username,
        must_change_password: member.user_account?.must_change_password,
        login_active: member.user_account?.is_active,
        last_login: member.user_account?.last_login,
      },
    });
  } catch (error) {
    console.error("getMyProfile error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const updateMyProfile = async (req, res) => {
  try {
    if (!req.user || req.user.type !== "member") {
      return res.status(403).json({ message: "Only members can update this profile" });
    }

    const {
      phone,
      email,
      department,
      address,
      employment_status,
      grade_level,
      bank_name,
      account_name,
      account_number,
    } = req.body;

    const member = await prisma.member.findUnique({
      where: { id: req.user.id },
    });

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    let normalizedDepartment = member.department;
    if (department !== undefined) {
      normalizedDepartment = department ? normalizeDepartment(department) : null;

      if (department && !normalizedDepartment) {
        return res.status(400).json({
          message:
            "Invalid department. Use one of: ARFFS, AVSEC, COMMERCIAL, STORE, ENVIRONMENT, ICT, ACCOUNTS, AUDIT, CREDIT CONTROL, SAFETY, OTHERS.",
        });
      }
    }

    if (email) {
      const existingEmail = await prisma.member.findFirst({
        where: {
          email: email.trim(),
          id: { not: req.user.id },
        },
      });

      if (existingEmail) {
        return res.status(400).json({
          message: "This email is already in use by another member.",
        });
      }
    }

    if (account_number && !/^\d{10}$/.test(account_number.trim())) {
      return res.status(400).json({
        message: "Account number must be exactly 10 digits.",
      });
    }

    const updatedMember = await prisma.member.update({
      where: { id: req.user.id },
      data: {
        phone: phone !== undefined ? (phone || null) : member.phone,
        email: email !== undefined ? (email ? email.trim() : null) : member.email,
        department: department !== undefined ? normalizedDepartment : member.department,
        address: address !== undefined ? (address || null) : member.address,
        employment_status:
          employment_status !== undefined
            ? (employment_status || null)
            : member.employment_status,
        grade_level: grade_level !== undefined ? (grade_level || null) : member.grade_level,
        bank_name: bank_name !== undefined ? (bank_name || null) : member.bank_name,
        account_name:
          account_name !== undefined ? (account_name || null) : member.account_name,
        account_number:
          account_number !== undefined ? (account_number || null) : member.account_number,
      },
    });

    return res.status(200).json({
      message: "Profile updated successfully",
      profile: updatedMember,
    });
  } catch (error) {
    console.error("updateMyProfile error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const submitPasswordChangeRequest = async (req, res) => {
  try {
    if (!req.user || req.user.type !== "member") {
      return res.status(403).json({ message: "Only members can submit password change requests" });
    }

    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        message: "Current password and new password are required.",
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters.",
      });
    }

    const member = await prisma.member.findUnique({
      where: { id: req.user.id },
      include: { user_account: true },
    });

    if (!member || !member.user_account) {
      return res.status(404).json({ message: "Member account not found" });
    }

    const passwordMatch = await bcrypt.compare(
      current_password,
      member.user_account.password_hash
    );

    if (!passwordMatch) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }

    const pendingRequest = await prisma.passwordChangeRequest.findFirst({
      where: {
        member_id: member.id,
        status: "pending",
      },
    });

    if (pendingRequest) {
      return res.status(400).json({
        message: "You already have a pending password change request.",
      });
    }

    const newPasswordHash = await bcrypt.hash(new_password, 10);

    const request = await prisma.passwordChangeRequest.create({
      data: {
        member_id: member.id,
        current_password,
        new_password_hash: newPasswordHash,
      },
    });

    return res.status(201).json({
      message: "Password change request submitted successfully. Await admin approval.",
      request_id: request.id,
      status: request.status,
    });
  } catch (error) {
    console.error("submitPasswordChangeRequest error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const getMyPasswordChangeRequests = async (req, res) => {
  try {
    if (!req.user || req.user.type !== "member") {
      return res.status(403).json({ message: "Only members can access this data" });
    }

    const requests = await prisma.passwordChangeRequest.findMany({
      where: {
        member_id: req.user.id,
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
      requests,
    });
  } catch (error) {
    console.error("getMyPasswordChangeRequests error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  submitPasswordChangeRequest,
  getMyPasswordChangeRequests,
};