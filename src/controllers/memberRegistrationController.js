const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");

const generateTemporaryPassword = (staffNo) => {
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `IBF${staffNo}${randomPart}`;
};

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

const buildFullName = (firstName, middleName, lastName) => {
  return `${firstName || ""}${middleName ? ` ${middleName}` : ""} ${lastName || ""}`
    .replace(/\s+/g, " ")
    .trim();
};

const submitRegistrationRequest = async (req, res) => {
  try {
    const {
      staff_no,
      membership_no,
      first_name,
      middle_name,
      last_name,
      phone,
      email,
      department,
      address,
      employment_status,
      grade_level,
      purpose,
      date_joined,
    } = req.body;

    if (!staff_no || !first_name || !last_name) {
      return res.status(400).json({
        message: "staff_no, first_name, and last_name are required.",
      });
    }

    const trimmedStaffNo = staff_no.trim();

    const existingMember = await prisma.member.findUnique({
      where: { staff_no: trimmedStaffNo },
    });

    if (existingMember) {
      return res.status(400).json({
        message: "This staff number is already registered.",
      });
    }

    const existingRequest = await prisma.memberRegistrationRequest.findUnique({
      where: { staff_no: trimmedStaffNo },
    });

    if (existingRequest && existingRequest.status === "pending") {
      return res.status(400).json({
        message: "A registration request for this staff number is already pending.",
      });
    }

    if (existingRequest && existingRequest.status === "rejected") {
      await prisma.memberRegistrationRequest.delete({
        where: { id: existingRequest.id },
      });
    }

    const normalizedDepartment = normalizeDepartment(department);

    if (department && !normalizedDepartment) {
      return res.status(400).json({
        message:
          "Invalid department. Use one of: ARFFS, AVSEC, COMMERCIAL, STORE, ENVIRONMENT, ICT, ACCOUNTS, AUDIT, CREDIT CONTROL, SAFETY, OTHERS.",
      });
    }

    const request = await prisma.memberRegistrationRequest.create({
      data: {
        staff_no: trimmedStaffNo,
        membership_no: membership_no || null,
        first_name,
        middle_name: middle_name || null,
        last_name,
        phone: phone || null,
        email: email || null,
        department: normalizedDepartment,
        address: address || null,
        employment_status: employment_status || null,
        grade_level: grade_level || null,
        purpose: purpose || null,
        date_joined: date_joined ? new Date(date_joined) : null,
      },
    });

    return res.status(201).json({
      message: "Registration request submitted successfully. Await admin approval.",
      request,
    });
  } catch (error) {
    console.error("submitRegistrationRequest error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
      detail: error.code || null,
    });
  }
};

const getAllRegistrationRequests = async (req, res) => {
  try {
    const requests = await prisma.memberRegistrationRequest.findMany({
      orderBy: { created_at: "desc" },
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
      message: "Registration requests retrieved successfully",
      count: requests.length,
      requests,
    });
  } catch (error) {
    console.error("getAllRegistrationRequests error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
      detail: error.code || null,
    });
  }
};

const approveRegistrationRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_note } = req.body;

    const request = await prisma.memberRegistrationRequest.findUnique({
      where: { id: Number(id) },
    });

    if (!request) {
      return res.status(404).json({ message: "Registration request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be approved" });
    }

    const existingMember = await prisma.member.findUnique({
      where: { staff_no: request.staff_no },
    });

    if (existingMember) {
      return res.status(400).json({
        message: "A member with this staff number already exists.",
      });
    }

    if (request.email) {
      const existingEmailMember = await prisma.member.findFirst({
        where: { email: request.email },
      });

      if (existingEmailMember) {
        return res.status(400).json({
          message: "A member with this email already exists.",
        });
      }
    }

    if (request.membership_no) {
      const existingMembership = await prisma.member.findFirst({
        where: { membership_no: request.membership_no },
      });

      if (existingMembership) {
        return res.status(400).json({
          message: "A member with this membership number already exists.",
        });
      }
    }

    const tempPassword = generateTemporaryPassword(request.staff_no);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const member = await tx.member.create({
        data: {
          staff_no: request.staff_no,
          membership_no: request.membership_no,
          first_name: request.first_name,
          middle_name: request.middle_name,
          last_name: request.last_name,
          phone: request.phone,
          email: request.email,
          department: request.department,
          address: request.address,
          employment_status: request.employment_status,
          grade_level: request.grade_level,
          purpose: request.purpose,
          date_joined: request.date_joined,
          status: "active",
        },
      });

      await tx.userAccount.create({
        data: {
          member_id: member.id,
          username: request.staff_no,
          password_hash: passwordHash,
          must_change_password: true,
          is_active: true,
        },
      });

      await tx.memberCredentialLog.create({
        data: {
          member_id: member.id,
          staff_no: request.staff_no,
          full_name: buildFullName(request.first_name, request.middle_name, request.last_name),
          credential_type: "INITIAL",
          plain_password: tempPassword,
          generated_by: req.user.id,
        },
      });

      const updatedRequest = await tx.memberRegistrationRequest.update({
        where: { id: request.id },
        data: {
          status: "approved",
          admin_note: admin_note || "Registration approved",
          reviewed_by: req.user.id,
          reviewed_at: new Date(),
        },
      });

      return { member, updatedRequest };
    });

    return res.status(200).json({
      message: "Registration request approved successfully",
      credential: {
        staff_no: result.member.staff_no,
        full_name: buildFullName(
          result.member.first_name,
          result.member.middle_name,
          result.member.last_name
        ),
        temporary_password: tempPassword,
      },
      member: result.member,
      request: result.updatedRequest,
    });
  } catch (error) {
    console.error("approveRegistrationRequest error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
      detail: error.code || null,
    });
  }
};

const rejectRegistrationRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_note } = req.body;

    const request = await prisma.memberRegistrationRequest.findUnique({
      where: { id: Number(id) },
    });

    if (!request) {
      return res.status(404).json({ message: "Registration request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be rejected" });
    }

    const updatedRequest = await prisma.memberRegistrationRequest.update({
      where: { id: request.id },
      data: {
        status: "rejected",
        admin_note: admin_note || "Registration rejected",
        reviewed_by: req.user.id,
        reviewed_at: new Date(),
      },
    });

    return res.status(200).json({
      message: "Registration request rejected successfully",
      request: updatedRequest,
    });
  } catch (error) {
    console.error("rejectRegistrationRequest error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
      detail: error.code || null,
    });
  }
};

module.exports = {
  submitRegistrationRequest,
  getAllRegistrationRequests,
  approveRegistrationRequest,
  rejectRegistrationRequest,
};