const fs = require("fs");
const XLSX = require("xlsx");
const prisma = require("../config/prisma");

const normalizeValue = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const numberValue = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  const num = Number(value);
  return Number.isNaN(num) ? NaN : num;
};

const parseSpreadsheet = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: "" });
};

const buildRow = async (row, rowNumber) => {
  const staff_no = normalizeValue(row.staff_no);

  const savings_balance = numberValue(row.savings_balance);
  const special_savings_balance = numberValue(row.special_savings_balance);
  const shares_balance = numberValue(row.shares_balance);

  // New proper principal + interest fields
  const long_term_principal_balance = numberValue(
    row.long_term_principal_balance ?? row.long_term_balance
  );
  const long_term_interest_balance = numberValue(row.long_term_interest_balance);

  const soft_principal_balance = numberValue(
    row.soft_principal_balance ?? row.soft_balance
  );
  const soft_interest_balance = numberValue(row.soft_interest_balance);

  const commodity_principal_balance = numberValue(
    row.commodity_principal_balance ?? row.commodity_balance
  );
  const commodity_interest_balance = numberValue(row.commodity_interest_balance);

  const description = normalizeValue(row.description);

  const reasons = [];

  if (!staff_no) reasons.push("Missing staff_no");

  const numericChecks = [
    ["savings_balance", savings_balance],
    ["special_savings_balance", special_savings_balance],
    ["shares_balance", shares_balance],
    ["long_term_principal_balance", long_term_principal_balance],
    ["long_term_interest_balance", long_term_interest_balance],
    ["soft_principal_balance", soft_principal_balance],
    ["soft_interest_balance", soft_interest_balance],
    ["commodity_principal_balance", commodity_principal_balance],
    ["commodity_interest_balance", commodity_interest_balance],
  ];

  numericChecks.forEach(([label, value]) => {
    if (Number.isNaN(value)) reasons.push(`Invalid number for ${label}`);
    if (!Number.isNaN(value) && value < 0) reasons.push(`${label} cannot be negative`);
  });

  let member = null;

  if (staff_no) {
    member = await prisma.member.findUnique({
      where: { staff_no },
      include: {
        savings_account: true,
        shares_account: true,
        loan_balances: true,
      },
    });

    if (!member) {
      reasons.push("Member not found");
    }
  }

  return {
    row_number: rowNumber,
    staff_no,

    savings_balance,
    special_savings_balance,
    shares_balance,

    long_term_principal_balance,
    long_term_interest_balance,
    long_term_total_balance:
      long_term_principal_balance + long_term_interest_balance,

    soft_principal_balance,
    soft_interest_balance,
    soft_total_balance: soft_principal_balance + soft_interest_balance,

    commodity_principal_balance,
    commodity_interest_balance,
    commodity_total_balance:
      commodity_principal_balance + commodity_interest_balance,

    description,
    member,
    status: reasons.length ? "invalid" : "valid",
    reasons,
  };
};

const previewOpeningBalances = async (req, res) => {
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

    const previewRows = [];
    for (let i = 0; i < rows.length; i++) {
      const result = await buildRow(rows[i], i + 2);
      previewRows.push(result);
    }

    const validRows = previewRows.filter((r) => r.status === "valid");
    const invalidRows = previewRows.filter((r) => r.status === "invalid");

    return res.status(200).json({
      message: "Opening balance preview generated successfully",
      summary: {
        total_rows: previewRows.length,
        valid_rows: validRows.length,
        invalid_rows: invalidRows.length,
      },
      rows: previewRows.map((r) => ({
        row_number: r.row_number,
        staff_no: r.staff_no,

        savings_balance: r.savings_balance,
        special_savings_balance: r.special_savings_balance,
        shares_balance: r.shares_balance,

        long_term_principal_balance: r.long_term_principal_balance,
        long_term_interest_balance: r.long_term_interest_balance,
        long_term_total_balance: r.long_term_total_balance,

        soft_principal_balance: r.soft_principal_balance,
        soft_interest_balance: r.soft_interest_balance,
        soft_total_balance: r.soft_total_balance,

        commodity_principal_balance: r.commodity_principal_balance,
        commodity_interest_balance: r.commodity_interest_balance,
        commodity_total_balance: r.commodity_total_balance,

        description: r.description,
        status: r.status,
        reasons: r.reasons,
      })),
    });
  } catch (error) {
    console.error("previewOpeningBalances error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
    });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

const upsertLoanBalanceBucket = async ({
  tx,
  memberId,
  bucketType,
  principalBalance,
  interestBalance,
  updatedBy,
}) => {
  const totalBalance = Number(principalBalance || 0) + Number(interestBalance || 0);

  const existing = await tx.memberLoanBalance.findUnique({
    where: {
      member_id_loan_bucket_type: {
        member_id: memberId,
        loan_bucket_type: bucketType,
      },
    },
  });

  if (existing) {
    return tx.memberLoanBalance.update({
      where: {
        member_id_loan_bucket_type: {
          member_id: memberId,
          loan_bucket_type: bucketType,
        },
      },
      data: {
        principal_balance: principalBalance,
        interest_balance: interestBalance,
        total_balance: totalBalance,
        last_updated_by: updatedBy,
      },
    });
  }

  return tx.memberLoanBalance.create({
    data: {
      member_id: memberId,
      loan_bucket_type: bucketType,
      principal_balance: principalBalance,
      interest_balance: interestBalance,
      total_balance: totalBalance,
      last_updated_by: updatedBy,
    },
  });
};

const importOpeningBalances = async (req, res) => {
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

    const processedRows = [];
    for (let i = 0; i < rows.length; i++) {
      const result = await buildRow(rows[i], i + 2);
      processedRows.push(result);
    }

    const validRows = processedRows.filter((r) => r.status === "valid");
    const invalidRows = processedRows
      .filter((r) => r.status === "invalid")
      .map((r) => ({
        row_number: r.row_number,
        staff_no: r.staff_no,
        reasons: r.reasons,
      }));

    const imported = [];

    for (const row of validRows) {
      try {
        await prisma.$transaction(async (tx) => {
          let savingsAccount = row.member.savings_account;
          let sharesAccount = row.member.shares_account;

          if (!savingsAccount) {
            savingsAccount = await tx.savingsAccount.create({
              data: { member_id: row.member.id },
            });
          }

          if (!sharesAccount) {
            sharesAccount = await tx.sharesAccount.create({
              data: { member_id: row.member.id },
            });
          }

          await tx.savingsAccount.update({
            where: { id: savingsAccount.id },
            data: {
              current_balance: row.savings_balance,
              total_contributed: row.savings_balance,
              special_savings_balance: row.special_savings_balance,
              total_special_contributed: row.special_savings_balance,
            },
          });

          await tx.sharesAccount.update({
            where: { id: sharesAccount.id },
            data: {
              current_balance: row.shares_balance,
              total_shares: row.shares_balance,
            },
          });

          await upsertLoanBalanceBucket({
            tx,
            memberId: row.member.id,
            bucketType: "LONG_TERM",
            principalBalance: row.long_term_principal_balance,
            interestBalance: row.long_term_interest_balance,
            updatedBy: req.user.id,
          });

          await upsertLoanBalanceBucket({
            tx,
            memberId: row.member.id,
            bucketType: "SOFT",
            principalBalance: row.soft_principal_balance,
            interestBalance: row.soft_interest_balance,
            updatedBy: req.user.id,
          });

          await upsertLoanBalanceBucket({
            tx,
            memberId: row.member.id,
            bucketType: "COMMODITY",
            principalBalance: row.commodity_principal_balance,
            interestBalance: row.commodity_interest_balance,
            updatedBy: req.user.id,
          });
        });

        imported.push({
          row_number: row.row_number,
          staff_no: row.staff_no,

          savings_balance: row.savings_balance,
          special_savings_balance: row.special_savings_balance,
          shares_balance: row.shares_balance,

          long_term_principal_balance: row.long_term_principal_balance,
          long_term_interest_balance: row.long_term_interest_balance,
          long_term_total_balance: row.long_term_total_balance,

          soft_principal_balance: row.soft_principal_balance,
          soft_interest_balance: row.soft_interest_balance,
          soft_total_balance: row.soft_total_balance,

          commodity_principal_balance: row.commodity_principal_balance,
          commodity_interest_balance: row.commodity_interest_balance,
          commodity_total_balance: row.commodity_total_balance,
        });
      } catch (error) {
        invalidRows.push({
          row_number: row.row_number,
          staff_no: row.staff_no,
          reasons: [error.message],
        });
      }
    }

    return res.status(201).json({
      message: "Opening balances import completed",
      summary: {
        total_rows: rows.length,
        imported_rows: imported.length,
        failed_rows: invalidRows.length,
      },
      imported,
      failed: invalidRows,
    });
  } catch (error) {
    console.error("importOpeningBalances error:", error);
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
  previewOpeningBalances,
  importOpeningBalances,
};