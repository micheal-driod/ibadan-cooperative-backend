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

const parsePostingDate = (value) => {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;

    return new Date(
      parsed.y,
      parsed.m - 1,
      parsed.d,
      parsed.H || 0,
      parsed.M || 0,
      parsed.S || 0
    );
  }

  const raw = String(value).trim();

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const numeric = Number(raw);
    const parsed = XLSX.SSF.parse_date_code(numeric);
    if (!parsed) return null;

    return new Date(
      parsed.y,
      parsed.m - 1,
      parsed.d,
      parsed.H || 0,
      parsed.M || 0,
      parsed.S || 0
    );
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return date;
};

const buildPostingRow = async (row, rowNumber) => {
  const staff_no = normalizeValue(row.staff_no);

  const posting_date_raw = row.posting_date;
  const posting_date_obj = parsePostingDate(posting_date_raw);
  const posting_date = posting_date_obj
    ? posting_date_obj.toISOString().split("T")[0]
    : "";

  const shares_credit = numberValue(row.shares_credit);

  const savings_debit = numberValue(row.savings_debit);
  const savings_credit = numberValue(row.savings_credit);

  const special_savings_debit = numberValue(row.special_savings_debit);
  const special_savings_credit = numberValue(row.special_savings_credit);

  const long_term_loan_taken = numberValue(row.long_term_loan_taken);
  const long_term_loan_repayment = numberValue(row.long_term_loan_repayment);

  const soft_loan_taken = numberValue(row.soft_loan_taken);
  const soft_loan_repayment = numberValue(row.soft_loan_repayment);

  const commodity_loan_taken = numberValue(row.commodity_loan_taken);
  const commodity_loan_repayment = numberValue(row.commodity_loan_repayment);

  const charges = numberValue(row.charges);
  const charges_label = normalizeValue(row.charges_label);

  const fines = numberValue(row.fines);
  const fines_label = normalizeValue(row.fines_label);

  const adjustment = numberValue(row.adjustment);
  const description = normalizeValue(row.description);

  const reasons = [];
  let member = null;

  if (!staff_no) reasons.push("Missing staff_no");

  if (!posting_date_raw && posting_date_raw !== 0) {
    reasons.push("Missing posting_date");
  } else if (!posting_date_obj) {
    reasons.push("Invalid posting_date");
  }

  const numericChecks = [
    ["shares_credit", shares_credit],
    ["savings_debit", savings_debit],
    ["savings_credit", savings_credit],
    ["special_savings_debit", special_savings_debit],
    ["special_savings_credit", special_savings_credit],
    ["long_term_loan_taken", long_term_loan_taken],
    ["long_term_loan_repayment", long_term_loan_repayment],
    ["soft_loan_taken", soft_loan_taken],
    ["soft_loan_repayment", soft_loan_repayment],
    ["commodity_loan_taken", commodity_loan_taken],
    ["commodity_loan_repayment", commodity_loan_repayment],
    ["charges", charges],
    ["fines", fines],
    ["adjustment", adjustment],
  ];

  numericChecks.forEach(([label, value]) => {
    if (Number.isNaN(value)) reasons.push(`Invalid number for ${label}`);
  });

  if (charges > 0 && !charges_label) {
    reasons.push("charges_label is required when charges > 0");
  }

  if (fines > 0 && !fines_label) {
    reasons.push("fines_label is required when fines > 0");
  }

  if (staff_no) {
    member = await prisma.member.findUnique({
      where: { staff_no },
      include: {
        savings_account: true,
        shares_account: true,
        loan_balances: true,
      },
    });

    if (!member) reasons.push("Member not found");
  }

  return {
    row_number: rowNumber,
    staff_no,
    posting_date,
    posting_date_obj,
    shares_credit,
    savings_debit,
    savings_credit,
    special_savings_debit,
    special_savings_credit,
    long_term_loan_taken,
    long_term_loan_repayment,
    soft_loan_taken,
    soft_loan_repayment,
    commodity_loan_taken,
    commodity_loan_repayment,
    charges,
    charges_label,
    fines,
    fines_label,
    adjustment,
    description,
    member,
    status: reasons.length ? "invalid" : "valid",
    reasons,
  };
};

const previewBulkMonthlyPosting = async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Spreadsheet file is required." });
    }

    filePath = req.file.path;
    const rows = parseSpreadsheet(filePath);

    if (!rows.length) {
      return res.status(400).json({ message: "Spreadsheet is empty." });
    }

    const previewRows = [];
    for (let i = 0; i < rows.length; i++) {
      const result = await buildPostingRow(rows[i], i + 2);
      previewRows.push(result);
    }

    return res.status(200).json({
      message: "Bulk monthly posting preview generated successfully",
      summary: {
        total_rows: previewRows.length,
        valid_rows: previewRows.filter((r) => r.status === "valid").length,
        invalid_rows: previewRows.filter((r) => r.status === "invalid").length,
        warning_rows: 0,
      },
      rows: previewRows.map((r) => ({
        row_number: r.row_number,
        staff_no: r.staff_no,
        posting_date: r.posting_date,
        shares_credit: r.shares_credit,
        savings_debit: r.savings_debit,
        savings_credit: r.savings_credit,
        special_savings_debit: r.special_savings_debit,
        special_savings_credit: r.special_savings_credit,
        long_term_loan_taken: r.long_term_loan_taken,
        long_term_loan_repayment: r.long_term_loan_repayment,
        soft_loan_taken: r.soft_loan_taken,
        soft_loan_repayment: r.soft_loan_repayment,
        commodity_loan_taken: r.commodity_loan_taken,
        commodity_loan_repayment: r.commodity_loan_repayment,
        charges: r.charges,
        fines: r.fines,
        adjustment: r.adjustment,
        status: r.status,
        reasons: r.reasons,
      })),
    });
  } catch (error) {
    console.error("previewBulkMonthlyPosting error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

const ensureSavingsAccount = async (tx, memberId, existingAccount) => {
  if (existingAccount) return existingAccount;

  return tx.savingsAccount.create({
    data: { member_id: memberId },
  });
};

const ensureSharesAccount = async (tx, memberId, existingAccount) => {
  if (existingAccount) return existingAccount;

  return tx.sharesAccount.create({
    data: { member_id: memberId },
  });
};

const ensureLoanBalanceBucket = async (tx, memberId, bucketType) => {
  const existing = await tx.memberLoanBalance.findUnique({
    where: {
      member_id_loan_bucket_type: {
        member_id: memberId,
        loan_bucket_type: bucketType,
      },
    },
  });

  if (existing) return existing;

  return tx.memberLoanBalance.create({
    data: {
      member_id: memberId,
      loan_bucket_type: bucketType,
      principal_balance: 0,
      interest_balance: 0,
      total_balance: 0,
    },
  });
};

const createLedger = async ({
  tx,
  memberId,
  staffUserId,
  entryType,
  amount,
  month,
  year,
  description,
  entryLabel = null,
}) => {
  await tx.memberLedger.create({
    data: {
      member_id: memberId,
      staff_user_id: staffUserId,
      entry_type: entryType,
      entry_label: entryLabel,
      amount,
      month,
      year,
      description,
    },
  });
};

const applySinglePosting = async (tx, row, staffUserId) => {
  const memberId = row.member.id;
  const postingDate = row.posting_date_obj;
  const month = postingDate.getMonth() + 1;
  const year = postingDate.getFullYear();

  let savingsAccount = await ensureSavingsAccount(tx, memberId, row.member.savings_account);
  let sharesAccount = await ensureSharesAccount(tx, memberId, row.member.shares_account);

  const longTermBucket = await ensureLoanBalanceBucket(tx, memberId, "LONG_TERM");
  const softBucket = await ensureLoanBalanceBucket(tx, memberId, "SOFT");
  const commodityBucket = await ensureLoanBalanceBucket(tx, memberId, "COMMODITY");

  const entries = [];

  if (row.shares_credit > 0) {
    await createLedger({
      tx,
      memberId,
      staffUserId,
      entryType: "SHARES",
      amount: row.shares_credit,
      month,
      year,
      description: row.description || "Monthly shares credit",
    });

    await tx.sharesAccount.update({
      where: { id: sharesAccount.id },
      data: {
        current_balance: { increment: row.shares_credit },
        total_shares: { increment: row.shares_credit },
      },
    });

    entries.push("SHARES_CREDIT");
  }

  if (row.savings_credit > 0) {
    await createLedger({
      tx,
      memberId,
      staffUserId,
      entryType: "SAVINGS",
      amount: row.savings_credit,
      month,
      year,
      description: row.description || "Monthly savings credit",
    });

    await tx.savingsAccount.update({
      where: { id: savingsAccount.id },
      data: {
        current_balance: { increment: row.savings_credit },
        total_contributed: { increment: row.savings_credit },
      },
    });

    entries.push("SAVINGS_CREDIT");
  }

  if (row.savings_debit > 0) {
    await createLedger({
      tx,
      memberId,
      staffUserId,
      entryType: "SAVINGS",
      amount: -row.savings_debit,
      month,
      year,
      description: row.description || "Monthly savings debit",
    });

    await tx.savingsAccount.update({
      where: { id: savingsAccount.id },
      data: {
        current_balance: { decrement: row.savings_debit },
      },
    });

    entries.push("SAVINGS_DEBIT");
  }

  if (row.special_savings_credit > 0) {
    await createLedger({
      tx,
      memberId,
      staffUserId,
      entryType: "SPECIAL_SAVINGS",
      amount: row.special_savings_credit,
      month,
      year,
      description: row.description || "Monthly special savings credit",
    });

    await tx.savingsAccount.update({
      where: { id: savingsAccount.id },
      data: {
        special_savings_balance: { increment: row.special_savings_credit },
        total_special_contributed: { increment: row.special_savings_credit },
      },
    });

    entries.push("SPECIAL_SAVINGS_CREDIT");
  }

  if (row.special_savings_debit > 0) {
    await createLedger({
      tx,
      memberId,
      staffUserId,
      entryType: "SPECIAL_SAVINGS",
      amount: -row.special_savings_debit,
      month,
      year,
      description: row.description || "Monthly special savings debit",
    });

    await tx.savingsAccount.update({
      where: { id: savingsAccount.id },
      data: {
        special_savings_balance: { decrement: row.special_savings_debit },
      },
    });

    entries.push("SPECIAL_SAVINGS_DEBIT");
  }

  if (row.long_term_loan_taken > 0) {
    await createLedger({
      tx,
      memberId,
      staffUserId,
      entryType: "LOAN_COLLECTED",
      amount: row.long_term_loan_taken,
      month,
      year,
      description: row.description || "Long term loan taken",
      entryLabel: "LONG_TERM",
    });

    await tx.memberLoanBalance.update({
      where: {
        member_id_loan_bucket_type: {
          member_id: memberId,
          loan_bucket_type: "LONG_TERM",
        },
      },
      data: {
        principal_balance: { increment: row.long_term_loan_taken },
        total_balance: { increment: row.long_term_loan_taken },
        last_updated_by: staffUserId,
      },
    });

    entries.push("LONG_TERM_LOAN_TAKEN");
  }

  if (row.long_term_loan_repayment > 0) {
    const current = await tx.memberLoanBalance.findUnique({
      where: {
        member_id_loan_bucket_type: {
          member_id: memberId,
          loan_bucket_type: "LONG_TERM",
        },
      },
    });

    if (Number(row.long_term_loan_repayment) > Number(current.principal_balance || 0)) {
      throw new Error(`Long term repayment exceeds current balance for ${row.staff_no}`);
    }

    await createLedger({
      tx,
      memberId,
      staffUserId,
      entryType: "LOAN_REPAYMENT",
      amount: row.long_term_loan_repayment,
      month,
      year,
      description: row.description || "Long term repayment",
      entryLabel: "LONG_TERM",
    });

    await tx.memberLoanBalance.update({
      where: {
        member_id_loan_bucket_type: {
          member_id: memberId,
          loan_bucket_type: "LONG_TERM",
        },
      },
      data: {
        principal_balance: { decrement: row.long_term_loan_repayment },
        total_balance: { decrement: row.long_term_loan_repayment },
        last_updated_by: staffUserId,
      },
    });

    entries.push("LONG_TERM_REPAYMENT");
  }

  if (row.soft_loan_taken > 0) {
    await createLedger({
      tx,
      memberId,
      staffUserId,
      entryType: "LOAN_COLLECTED",
      amount: row.soft_loan_taken,
      month,
      year,
      description: row.description || "Soft loan taken",
      entryLabel: "SOFT",
    });

    await tx.memberLoanBalance.update({
      where: {
        member_id_loan_bucket_type: {
          member_id: memberId,
          loan_bucket_type: "SOFT",
        },
      },
      data: {
        principal_balance: { increment: row.soft_loan_taken },
        total_balance: { increment: row.soft_loan_taken },
        last_updated_by: staffUserId,
      },
    });

    entries.push("SOFT_LOAN_TAKEN");
  }

  if (row.soft_loan_repayment > 0) {
    const current = await tx.memberLoanBalance.findUnique({
      where: {
        member_id_loan_bucket_type: {
          member_id: memberId,
          loan_bucket_type: "SOFT",
        },
      },
    });

    if (Number(row.soft_loan_repayment) > Number(current.principal_balance || 0)) {
      throw new Error(`Soft repayment exceeds current balance for ${row.staff_no}`);
    }

    await createLedger({
      tx,
      memberId,
      staffUserId,
      entryType: "LOAN_REPAYMENT",
      amount: row.soft_loan_repayment,
      month,
      year,
      description: row.description || "Soft repayment",
      entryLabel: "SOFT",
    });

    await tx.memberLoanBalance.update({
      where: {
        member_id_loan_bucket_type: {
          member_id: memberId,
          loan_bucket_type: "SOFT",
        },
      },
      data: {
        principal_balance: { decrement: row.soft_loan_repayment },
        total_balance: { decrement: row.soft_loan_repayment },
        last_updated_by: staffUserId,
      },
    });

    entries.push("SOFT_REPAYMENT");
  }

  if (row.commodity_loan_taken > 0) {
    await createLedger({
      tx,
      memberId,
      staffUserId,
      entryType: "LOAN_COLLECTED",
      amount: row.commodity_loan_taken,
      month,
      year,
      description: row.description || "Commodity loan taken",
      entryLabel: "COMMODITY",
    });

    await tx.memberLoanBalance.update({
      where: {
        member_id_loan_bucket_type: {
          member_id: memberId,
          loan_bucket_type: "COMMODITY",
        },
      },
      data: {
        principal_balance: { increment: row.commodity_loan_taken },
        total_balance: { increment: row.commodity_loan_taken },
        last_updated_by: staffUserId,
      },
    });

    entries.push("COMMODITY_LOAN_TAKEN");
  }

  if (row.commodity_loan_repayment > 0) {
    const current = await tx.memberLoanBalance.findUnique({
      where: {
        member_id_loan_bucket_type: {
          member_id: memberId,
          loan_bucket_type: "COMMODITY",
        },
      },
    });

    if (Number(row.commodity_loan_repayment) > Number(current.principal_balance || 0)) {
      throw new Error(`Commodity repayment exceeds current balance for ${row.staff_no}`);
    }

    await createLedger({
      tx,
      memberId,
      staffUserId,
      entryType: "LOAN_REPAYMENT",
      amount: row.commodity_loan_repayment,
      month,
      year,
      description: row.description || "Commodity repayment",
      entryLabel: "COMMODITY",
    });

    await tx.memberLoanBalance.update({
      where: {
        member_id_loan_bucket_type: {
          member_id: memberId,
          loan_bucket_type: "COMMODITY",
        },
      },
      data: {
        principal_balance: { decrement: row.commodity_loan_repayment },
        total_balance: { decrement: row.commodity_loan_repayment },
        last_updated_by: staffUserId,
      },
    });

    entries.push("COMMODITY_REPAYMENT");
  }

  if (row.charges > 0) {
    await createLedger({
      tx,
      memberId,
      staffUserId,
      entryType: "CHARGES",
      amount: row.charges,
      month,
      year,
      description: row.description || "Charge posting",
      entryLabel: row.charges_label,
    });

    entries.push("CHARGES");
  }

  if (row.fines > 0) {
    await createLedger({
      tx,
      memberId,
      staffUserId,
      entryType: "FINES",
      amount: row.fines,
      month,
      year,
      description: row.description || "Fine posting",
      entryLabel: row.fines_label,
    });

    entries.push("FINES");
  }

  if (row.adjustment !== 0) {
    await createLedger({
      tx,
      memberId,
      staffUserId,
      entryType: "ADJUSTMENT",
      amount: row.adjustment,
      month,
      year,
      description: row.description || "Adjustment posting",
    });

    entries.push("ADJUSTMENT");
  }

  return entries;
};

const importBulkMonthlyPosting = async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Spreadsheet file is required." });
    }

    filePath = req.file.path;
    const rows = parseSpreadsheet(filePath);

    if (!rows.length) {
      return res.status(400).json({ message: "Spreadsheet is empty." });
    }

    const processedRows = [];
    for (let i = 0; i < rows.length; i++) {
      const result = await buildPostingRow(rows[i], i + 2);
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
        const entries = await prisma.$transaction(async (tx) => {
          return applySinglePosting(tx, row, req.user.id);
        });

        imported.push({
          row_number: row.row_number,
          staff_no: row.staff_no,
          posting_date: row.posting_date,
          entries_posted: entries,
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
      message: "Bulk monthly posting import completed",
      summary: {
        total_rows: rows.length,
        imported_rows: imported.length,
        failed_rows: invalidRows.length,
      },
      imported,
      failed: invalidRows,
    });
  } catch (error) {
    console.error("importBulkMonthlyPosting error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

module.exports = {
  previewBulkMonthlyPosting,
  importBulkMonthlyPosting,
};