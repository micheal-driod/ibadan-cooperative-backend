const bcrypt = require("bcryptjs");
const PDFDocument = require("pdfkit");
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

const generateTemporaryPassword = (staffNo) => {
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `IBF${staffNo}${randomPart}`;
};

const addExistingMember = async (req, res) => {
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
      status,
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

    if (email) {
      const existingEmail = await prisma.member.findFirst({
        where: { email: email.trim() },
      });

      if (existingEmail) {
        return res.status(400).json({
          message: "This email is already in use.",
        });
      }
    }

    if (membership_no) {
      const existingMembership = await prisma.member.findFirst({
        where: { membership_no: membership_no.trim() },
      });

      if (existingMembership) {
        return res.status(400).json({
          message: "This membership number is already in use.",
        });
      }
    }

    const normalizedDepartment = normalizeDepartment(department);

    if (department && !normalizedDepartment) {
      return res.status(400).json({
        message:
          "Invalid department. Use one of: ARFFS, AVSEC, COMMERCIAL, STORE, ENVIRONMENT, ICT, ACCOUNTS, AUDIT, CREDIT CONTROL, SAFETY, OTHERS.",
      });
    }

    const temporaryPassword = generateTemporaryPassword(trimmedStaffNo);
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const fullName =
      `${first_name}${middle_name ? " " + middle_name : ""} ${last_name}`.trim();

    const result = await prisma.$transaction(async (tx) => {
      const member = await tx.member.create({
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
          status: status || "active",
        },
      });

      await tx.userAccount.create({
        data: {
          member_id: member.id,
          username: trimmedStaffNo,
          password_hash: passwordHash,
          must_change_password: true,
          is_active: true,
        },
      });

      const credentialLog = await tx.memberCredentialLog.create({
        data: {
          member_id: member.id,
          staff_no: trimmedStaffNo,
          full_name: fullName,
          credential_type: "INITIAL",
          plain_password: temporaryPassword,
          generated_by: req.user.id,
        },
      });

      return { member, credentialLog };
    });

    return res.status(201).json({
      message: "Member onboarded successfully",
      member: result.member,
      credential: result.credentialLog,
    });
  } catch (error) {
    console.error("addExistingMember error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

const getCredentialLogs = async (req, res) => {
  try {
    const logs = await prisma.memberCredentialLog.findMany({
      orderBy: {
        created_at: "desc",
      },
      include: {
        generator: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Credential logs retrieved successfully",
      count: logs.length,
      credentials: logs,
    });
  } catch (error) {
    console.error("getCredentialLogs error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

const downloadCredentialLogsPdf = async (req, res) => {
  try {
    const { ids } = req.query;

    let whereClause = {};

    if (ids) {
      const parsedIds = ids
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => !Number.isNaN(id));

      whereClause = {
        id: {
          in: parsedIds,
        },
      };
    }

    const logs = await prisma.memberCredentialLog.findMany({
      where: whereClause,
      orderBy: {
        created_at: "desc",
      },
    });

    if (!logs.length) {
      return res.status(404).json({
        message: "No credential logs found for PDF export.",
      });
    }

    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="member_credentials.pdf"'
    );

    doc.pipe(res);

    doc.fontSize(18).text("IBARFFS COOPs Member Credentials", {
      align: "center",
    });

    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, {
      align: "center",
    });

    doc.moveDown(1.5);

    let y = doc.y;

    doc.fontSize(11).text("S/N", 40, y);
    doc.text("Full Name", 80, y);
    doc.text("Staff No", 270, y);
    doc.text("Password", 360, y);
    doc.text("Type", 480, y);

    doc.moveTo(40, y + 15).lineTo(555, y + 15).stroke();

    y += 25;

    logs.forEach((item, index) => {
      if (y > 760) {
        doc.addPage();
        y = 50;
      }

      doc.fontSize(10).text(String(index + 1), 40, y);
      doc.text(item.full_name, 80, y, { width: 170 });
      doc.text(item.staff_no, 270, y, { width: 70 });
      doc.text(item.plain_password, 360, y, { width: 100 });
      doc.text(item.credential_type, 480, y, { width: 60 });

      y += 35;
    });

    doc.end();
  } catch (error) {
    console.error("downloadCredentialLogsPdf error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

module.exports = {
  addExistingMember,
  getCredentialLogs,
  downloadCredentialLogsPdf,
};