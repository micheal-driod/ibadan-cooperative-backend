const fs = require("fs");
const bcrypt = require("bcryptjs");
const XLSX = require("xlsx");
const prisma = require("../config/prisma");

const normalizeValue = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const generateTemporaryPassword = (staffNo) => {
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `IBF${staffNo}${randomPart}`;
};

const parseSpreadsheet = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: "" });
};

const buildFullName = (firstName, middleName, lastName) => {
  return `${firstName}${middleName ? ` ${middleName}` : ""} ${lastName}`.trim();
};

const previewBulkOnboarding = async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Spreadsheet file is required.",
      });
    }

    filePath = req.file.path;

    const rows = parseSpreadsheet(filePath);

    if (!rows.length) {
      return res.status(400).json({
        message: "Spreadsheet is empty.",
      });
    }

    const seenStaffNosInFile = new Set();
    const previewRows = [];

    const dbMembers = await prisma.member.findMany({
      select: {
        staff_no: true,
      },
    });

    const dbStaffNoSet = new Set(dbMembers.map((m) => m.staff_no));

    rows.forEach((row, index) => {
      const staff_no = normalizeValue(row.staff_no);
      const first_name = normalizeValue(row.first_name);
      const middle_name = normalizeValue(row.middle_name);
      const last_name = normalizeValue(row.last_name);

      let status = "valid";
      const reasons = [];

      if (!staff_no) reasons.push("Missing staff_no");
      if (!first_name) reasons.push("Missing first_name");
      if (!last_name) reasons.push("Missing last_name");

      if (staff_no && seenStaffNosInFile.has(staff_no)) {
        reasons.push("Duplicate staff_no in uploaded file");
      }

      if (staff_no && dbStaffNoSet.has(staff_no)) {
        reasons.push("staff_no already exists in database");
      }

      if (staff_no) {
        seenStaffNosInFile.add(staff_no);
      }

      if (reasons.length) {
        status = reasons.some((r) => r.includes("Duplicate") || r.includes("already exists"))
          ? "duplicate"
          : "invalid";
      }

      previewRows.push({
        row_number: index + 2,
        staff_no,
        first_name,
        middle_name,
        last_name,
        full_name: buildFullName(first_name, middle_name, last_name),
        status,
        reasons,
      });
    });

    const validRows = previewRows.filter((r) => r.status === "valid");
    const invalidRows = previewRows.filter((r) => r.status === "invalid");
    const duplicateRows = previewRows.filter((r) => r.status === "duplicate");

    return res.status(200).json({
      message: "Bulk onboarding preview generated successfully",
      summary: {
        total_rows: previewRows.length,
        valid_rows: validRows.length,
        invalid_rows: invalidRows.length,
        duplicate_rows: duplicateRows.length,
      },
      rows: previewRows,
    });
  } catch (error) {
    console.error("previewBulkOnboarding error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
    });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

const importBulkOnboarding = async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Spreadsheet file is required.",
      });
    }

    filePath = req.file.path;
    const rows = parseSpreadsheet(filePath);

    if (!rows.length) {
      return res.status(400).json({
        message: "Spreadsheet is empty.",
      });
    }

    const seenStaffNosInFile = new Set();
    const processableRows = [];
    const failedRows = [];

    rows.forEach((row, index) => {
      const staff_no = normalizeValue(row.staff_no);
      const first_name = normalizeValue(row.first_name);
      const middle_name = normalizeValue(row.middle_name);
      const last_name = normalizeValue(row.last_name);

      const reasons = [];

      if (!staff_no) reasons.push("Missing staff_no");
      if (!first_name) reasons.push("Missing first_name");
      if (!last_name) reasons.push("Missing last_name");

      if (staff_no && seenStaffNosInFile.has(staff_no)) {
        reasons.push("Duplicate staff_no in uploaded file");
      }

      if (staff_no) {
        seenStaffNosInFile.add(staff_no);
      }

      if (reasons.length) {
        failedRows.push({
          row_number: index + 2,
          staff_no,
          first_name,
          middle_name,
          last_name,
          reasons,
        });
      } else {
        processableRows.push({
          row_number: index + 2,
          staff_no,
          first_name,
          middle_name,
          last_name,
        });
      }
    });

    const imported = [];

    for (const row of processableRows) {
      const fullName = buildFullName(row.first_name, row.middle_name, row.last_name);

      try {
        const existingMember = await prisma.member.findUnique({
          where: { staff_no: row.staff_no },
          include: {
            credential_logs: {
              orderBy: { created_at: "desc" },
              take: 1,
            },
          },
        });

        if (existingMember) {
          const latestCredential = existingMember.credential_logs?.[0];

          imported.push({
            row_number: row.row_number,
            member_id: existingMember.id,
            staff_no: existingMember.staff_no,
            full_name: buildFullName(
              existingMember.first_name,
              existingMember.middle_name,
              existingMember.last_name
            ),
            temporary_password: latestCredential?.plain_password || "ALREADY CREATED",
            note: "Existing member returned from database",
          });

          continue;
        }

        const temporaryPassword = generateTemporaryPassword(row.staff_no);
        const passwordHash = await bcrypt.hash(temporaryPassword, 10);

        const result = await prisma.$transaction(async (tx) => {
          const member = await tx.member.create({
            data: {
              staff_no: row.staff_no,
              first_name: row.first_name,
              middle_name: row.middle_name || null,
              last_name: row.last_name,
              status: "active",
            },
          });

          await tx.userAccount.create({
            data: {
              member_id: member.id,
              username: row.staff_no,
              password_hash: passwordHash,
              must_change_password: true,
              is_active: true,
            },
          });

          const credentialLog = await tx.memberCredentialLog.create({
            data: {
              member_id: member.id,
              staff_no: row.staff_no,
              full_name: fullName,
              credential_type: "INITIAL",
              plain_password: temporaryPassword,
              generated_by: req.user.id,
            },
          });

          return { member, credentialLog };
        });

        imported.push({
          row_number: row.row_number,
          member_id: result.member.id,
          staff_no: row.staff_no,
          full_name: fullName,
          temporary_password: result.credentialLog.plain_password,
        });
      } catch (error) {
        failedRows.push({
          row_number: row.row_number,
          staff_no: row.staff_no,
          first_name: row.first_name,
          middle_name: row.middle_name,
          last_name: row.last_name,
          reasons: [error.message || "Import failed"],
        });
      }
    }

    return res.status(201).json({
      message: "Bulk onboarding import completed",
      summary: {
        total_rows: rows.length,
        imported_rows: imported.length,
        failed_rows: failedRows.length,
      },
      imported,
      failed: failedRows,
    });
  } catch (error) {
    console.error("importBulkOnboarding error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
    });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

module.exports = {
  previewBulkOnboarding,
  importBulkOnboarding,
};