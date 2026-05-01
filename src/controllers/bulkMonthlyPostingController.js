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

const generateBatchCode = () => {
  return `POST-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
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

  await ensureLoanBalanceBucket(tx, memberId, "LONG_TERM");
  await ensureLoanBalanceBucket(tx, memberId, "SOFT");
  await ensureLoanBalanceBucket(tx, memberId, "COMMODITY");

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

const createMonthlyPostingRow = async (tx, batchId, row, entries) => {
  return tx.monthlyPostingRow.create({
    data: {
      batch_id: batchId,
      member_id: row.member.id,
      staff_no: row.staff_no,
      posting_date: row.posting_date_obj,
      shares_credit: row.shares_credit,
      savings_debit: row.savings_debit,
      savings_credit: row.savings_credit,
      special_savings_debit: row.special_savings_debit,
      special_savings_credit: row.special_savings_credit,
      long_term_loan_taken: row.long_term_loan_taken,
      long_term_loan_repayment: row.long_term_loan_repayment,
      soft_loan_taken: row.soft_loan_taken,
      soft_loan_repayment: row.soft_loan_repayment,
      commodity_loan_taken: row.commodity_loan_taken,
      commodity_loan_repayment: row.commodity_loan_repayment,
      charges: row.charges,
      charges_label: row.charges_label || null,
      fines: row.fines,
      fines_label: row.fines_label || null,
      adjustment: row.adjustment,
      description: row.description || null,
      entries_posted: entries,
      status: "imported",
    },
  });
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

    const batch = await prisma.monthlyPostingBatch.create({
      data: {
        batch_code: generateBatchCode(),
        uploaded_by: req.user.id,
        total_rows: rows.length,
        imported_rows: 0,
        failed_rows: invalidRows.length,
      },
    });

    const imported = [];

    for (const row of validRows) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const entries = await applySinglePosting(tx, row, req.user.id);
          const savedRow = await createMonthlyPostingRow(tx, batch.id, row, entries);

          return { entries, savedRow };
        });

        imported.push({
          id: result.savedRow.id,
          batch_id: batch.id,
          row_number: row.row_number,
          staff_no: row.staff_no,
          posting_date: row.posting_date,
          entries_posted: result.entries,
        });
      } catch (error) {
        invalidRows.push({
          row_number: row.row_number,
          staff_no: row.staff_no,
          reasons: [error.message],
        });
      }
    }

    await prisma.monthlyPostingBatch.update({
      where: { id: batch.id },
      data: {
        imported_rows: imported.length,
        failed_rows: invalidRows.length,
      },
    });

    return res.status(201).json({
      message: "Bulk monthly posting import completed",
      batch_id: batch.id,
      batch_code: batch.batch_code,
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

const getMonthlyPostingBatches = async (req, res) => {
  try {
    const batches = await prisma.monthlyPostingBatch.findMany({
      orderBy: { created_at: "desc" },
      include: {
        uploader: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Monthly posting batches retrieved successfully",
      count: batches.length,
      batches,
    });
  } catch (error) {
    console.error("getMonthlyPostingBatches error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

const getMonthlyPostingBatchById = async (req, res) => {
  try {
    const batchId = Number(req.params.id);

    const batch = await prisma.monthlyPostingBatch.findUnique({
      where: { id: batchId },
      include: {
        uploader: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        rows: {
          orderBy: { id: "asc" },
          include: {
            member: {
              select: {
                id: true,
                staff_no: true,
                first_name: true,
                middle_name: true,
                last_name: true,
              },
            },
            editor: {
              select: {
                id: true,
                full_name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ message: "Monthly posting batch not found" });
    }

    return res.status(200).json({
      message: "Monthly posting batch retrieved successfully",
      batch,
    });
  } catch (error) {
    console.error("getMonthlyPostingBatchById error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

const applyCorrectionLedger = async ({
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
  if (amount === 0) return;

  await createLedger({
    tx,
    memberId,
    staffUserId,
    entryType,
    amount,
    month,
    year,
    description,
    entryLabel,
  });
};

const updateMonthlyPostingRow = async (req, res) => {
  try {
    const rowId = Number(req.params.id);

    const existingRow = await prisma.monthlyPostingRow.findUnique({
      where: { id: rowId },
      include: {
        member: {
          include: {
            savings_account: true,
            shares_account: true,
            loan_balances: true,
          },
        },
        batch: true,
      },
    });

    if (!existingRow) {
      return res.status(404).json({ message: "Monthly posting row not found" });
    }

    const postingDateObj = req.body.posting_date
      ? parsePostingDate(req.body.posting_date)
      : existingRow.posting_date;

    if (!postingDateObj) {
      return res.status(400).json({ message: "Invalid posting_date" });
    }

    const newData = {
      posting_date: postingDateObj,
      shares_credit: numberValue(req.body.shares_credit ?? existingRow.shares_credit),
      savings_debit: numberValue(req.body.savings_debit ?? existingRow.savings_debit),
      savings_credit: numberValue(req.body.savings_credit ?? existingRow.savings_credit),
      special_savings_debit: numberValue(req.body.special_savings_debit ?? existingRow.special_savings_debit),
      special_savings_credit: numberValue(req.body.special_savings_credit ?? existingRow.special_savings_credit),
      long_term_loan_taken: numberValue(req.body.long_term_loan_taken ?? existingRow.long_term_loan_taken),
      long_term_loan_repayment: numberValue(req.body.long_term_loan_repayment ?? existingRow.long_term_loan_repayment),
      soft_loan_taken: numberValue(req.body.soft_loan_taken ?? existingRow.soft_loan_taken),
      soft_loan_repayment: numberValue(req.body.soft_loan_repayment ?? existingRow.soft_loan_repayment),
      commodity_loan_taken: numberValue(req.body.commodity_loan_taken ?? existingRow.commodity_loan_taken),
      commodity_loan_repayment: numberValue(req.body.commodity_loan_repayment ?? existingRow.commodity_loan_repayment),
      charges: numberValue(req.body.charges ?? existingRow.charges),
      charges_label: normalizeValue(req.body.charges_label ?? existingRow.charges_label),
      fines: numberValue(req.body.fines ?? existingRow.fines),
      fines_label: normalizeValue(req.body.fines_label ?? existingRow.fines_label),
      adjustment: numberValue(req.body.adjustment ?? existingRow.adjustment),
      description: normalizeValue(req.body.description ?? existingRow.description),
    };

    const numberFields = [
      "shares_credit",
      "savings_debit",
      "savings_credit",
      "special_savings_debit",
      "special_savings_credit",
      "long_term_loan_taken",
      "long_term_loan_repayment",
      "soft_loan_taken",
      "soft_loan_repayment",
      "commodity_loan_taken",
      "commodity_loan_repayment",
      "charges",
      "fines",
      "adjustment",
    ];

    for (const field of numberFields) {
      if (Number.isNaN(newData[field])) {
        return res.status(400).json({ message: `Invalid number for ${field}` });
      }
    }

    if (newData.charges > 0 && !newData.charges_label) {
      return res.status(400).json({ message: "charges_label is required when charges > 0" });
    }

    if (newData.fines > 0 && !newData.fines_label) {
      return res.status(400).json({ message: "fines_label is required when fines > 0" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const memberId = existingRow.member_id;
      const month = postingDateObj.getMonth() + 1;
      const year = postingDateObj.getFullYear();

      const savingsAccount = await ensureSavingsAccount(
        tx,
        memberId,
        existingRow.member.savings_account
      );

      const sharesAccount = await ensureSharesAccount(
        tx,
        memberId,
        existingRow.member.shares_account
      );

      await ensureLoanBalanceBucket(tx, memberId, "LONG_TERM");
      await ensureLoanBalanceBucket(tx, memberId, "SOFT");
      await ensureLoanBalanceBucket(tx, memberId, "COMMODITY");

      const oldValue = (field) => Number(existingRow[field] || 0);
      const delta = (field) => Number(newData[field] || 0) - oldValue(field);

      const correctionEntries = [];

      const postCorrection = async (label, entryType, amount, entryLabel = null) => {
        if (amount === 0) return;

        await applyCorrectionLedger({
          tx,
          memberId,
          staffUserId: req.user.id,
          entryType,
          amount,
          month,
          year,
          description: `Correction for monthly posting row #${rowId}`,
          entryLabel,
        });

        correctionEntries.push(label);
      };

      const updateSavings = async (data) => {
        await tx.savingsAccount.update({
          where: { id: savingsAccount.id },
          data,
        });
      };

      const updateShares = async (data) => {
        await tx.sharesAccount.update({
          where: { id: sharesAccount.id },
          data,
        });
      };

      const updateLoanBalance = async (bucket, principalDelta, totalDelta) => {
        const current = await tx.memberLoanBalance.findUnique({
          where: {
            member_id_loan_bucket_type: {
              member_id: memberId,
              loan_bucket_type: bucket,
            },
          },
        });

        if (principalDelta < 0 && Number(current.principal_balance || 0) < Math.abs(principalDelta)) {
          throw new Error(`${bucket} correction will make principal balance negative`);
        }

        if (totalDelta < 0 && Number(current.total_balance || 0) < Math.abs(totalDelta)) {
          throw new Error(`${bucket} correction will make total balance negative`);
        }

        await tx.memberLoanBalance.update({
          where: {
            member_id_loan_bucket_type: {
              member_id: memberId,
              loan_bucket_type: bucket,
            },
          },
          data: {
            principal_balance:
              principalDelta >= 0
                ? { increment: principalDelta }
                : { decrement: Math.abs(principalDelta) },
            total_balance:
              totalDelta >= 0
                ? { increment: totalDelta }
                : { decrement: Math.abs(totalDelta) },
            last_updated_by: req.user.id,
          },
        });
      };

      const sharesDelta = delta("shares_credit");
      if (sharesDelta !== 0) {
        await postCorrection("SHARES_CORRECTION", "SHARES", sharesDelta);
        await updateShares({
          current_balance:
            sharesDelta >= 0 ? { increment: sharesDelta } : { decrement: Math.abs(sharesDelta) },
          total_shares:
            sharesDelta >= 0 ? { increment: sharesDelta } : { decrement: Math.abs(sharesDelta) },
        });
      }

      const savingsCreditDelta = delta("savings_credit");
      if (savingsCreditDelta !== 0) {
        await postCorrection("SAVINGS_CREDIT_CORRECTION", "SAVINGS", savingsCreditDelta);
        await updateSavings({
          current_balance:
            savingsCreditDelta >= 0
              ? { increment: savingsCreditDelta }
              : { decrement: Math.abs(savingsCreditDelta) },
          total_contributed:
            savingsCreditDelta >= 0
              ? { increment: savingsCreditDelta }
              : { decrement: Math.abs(savingsCreditDelta) },
        });
      }

      const savingsDebitDelta = delta("savings_debit");
      if (savingsDebitDelta !== 0) {
        await postCorrection("SAVINGS_DEBIT_CORRECTION", "SAVINGS", -savingsDebitDelta);
        await updateSavings({
          current_balance:
            savingsDebitDelta >= 0
              ? { decrement: savingsDebitDelta }
              : { increment: Math.abs(savingsDebitDelta) },
        });
      }

      const specialCreditDelta = delta("special_savings_credit");
      if (specialCreditDelta !== 0) {
        await postCorrection("SPECIAL_SAVINGS_CREDIT_CORRECTION", "SPECIAL_SAVINGS", specialCreditDelta);
        await updateSavings({
          special_savings_balance:
            specialCreditDelta >= 0
              ? { increment: specialCreditDelta }
              : { decrement: Math.abs(specialCreditDelta) },
          total_special_contributed:
            specialCreditDelta >= 0
              ? { increment: specialCreditDelta }
              : { decrement: Math.abs(specialCreditDelta) },
        });
      }

      const specialDebitDelta = delta("special_savings_debit");
      if (specialDebitDelta !== 0) {
        await postCorrection("SPECIAL_SAVINGS_DEBIT_CORRECTION", "SPECIAL_SAVINGS", -specialDebitDelta);
        await updateSavings({
          special_savings_balance:
            specialDebitDelta >= 0
              ? { decrement: specialDebitDelta }
              : { increment: Math.abs(specialDebitDelta) },
        });
      }

      const loanCorrections = [
        ["LONG_TERM", "long_term_loan_taken", "long_term_loan_repayment"],
        ["SOFT", "soft_loan_taken", "soft_loan_repayment"],
        ["COMMODITY", "commodity_loan_taken", "commodity_loan_repayment"],
      ];

      for (const [bucket, takenField, repaymentField] of loanCorrections) {
        const takenDelta = delta(takenField);
        if (takenDelta !== 0) {
          await postCorrection(`${bucket}_LOAN_TAKEN_CORRECTION`, "LOAN_COLLECTED", takenDelta, bucket);
          await updateLoanBalance(bucket, takenDelta, takenDelta);
        }

        const repaymentDelta = delta(repaymentField);
        if (repaymentDelta !== 0) {
          await postCorrection(`${bucket}_REPAYMENT_CORRECTION`, "LOAN_REPAYMENT", repaymentDelta, bucket);
          await updateLoanBalance(bucket, -repaymentDelta, -repaymentDelta);
        }
      }

      const chargesDelta = delta("charges");
      if (chargesDelta !== 0) {
        await postCorrection("CHARGES_CORRECTION", "CHARGES", chargesDelta, newData.charges_label);
      }

      const finesDelta = delta("fines");
      if (finesDelta !== 0) {
        await postCorrection("FINES_CORRECTION", "FINES", finesDelta, newData.fines_label);
      }

      const adjustmentDelta = delta("adjustment");
      if (adjustmentDelta !== 0) {
        await postCorrection("ADJUSTMENT_CORRECTION", "ADJUSTMENT", adjustmentDelta);
      }

      const updatedRow = await tx.monthlyPostingRow.update({
        where: { id: rowId },
        data: {
          ...newData,
          entries_posted: [
            ...(existingRow.entries_posted || []),
            ...correctionEntries,
          ],
          status: "edited",
          edited_by: req.user.id,
          edited_at: new Date(),
        },
      });

      return {
        updatedRow,
        correctionEntries,
      };
    });

    return res.status(200).json({
      message: "Monthly posting row updated successfully",
      row: result.updatedRow,
      entries_posted: result.correctionEntries,
    });
  } catch (error) {
    console.error("updateMonthlyPostingRow error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

module.exports = {
  previewBulkMonthlyPosting,
  importBulkMonthlyPosting,
  getMonthlyPostingBatches,
  getMonthlyPostingBatchById,
  updateMonthlyPostingRow,
};