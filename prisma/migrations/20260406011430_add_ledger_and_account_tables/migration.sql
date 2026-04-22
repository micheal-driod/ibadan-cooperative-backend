-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('SAVINGS', 'SHARES', 'LOAN_COLLECTED', 'LOAN_REPAYMENT', 'LOAN_INTEREST_DEDUCTION', 'CHARGES_FINES', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "SavingsAccount" (
    "id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "current_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_contributed" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharesAccount" (
    "id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "current_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_shares" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharesAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberLedger" (
    "id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "staff_user_id" INTEGER NOT NULL,
    "loan_id" INTEGER,
    "entry_type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavingsAccount_member_id_key" ON "SavingsAccount"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "SharesAccount_member_id_key" ON "SharesAccount"("member_id");

-- CreateIndex
CREATE INDEX "MemberLedger_member_id_idx" ON "MemberLedger"("member_id");

-- CreateIndex
CREATE INDEX "MemberLedger_staff_user_id_idx" ON "MemberLedger"("staff_user_id");

-- CreateIndex
CREATE INDEX "MemberLedger_loan_id_idx" ON "MemberLedger"("loan_id");

-- CreateIndex
CREATE INDEX "MemberLedger_month_year_idx" ON "MemberLedger"("month", "year");

-- AddForeignKey
ALTER TABLE "SavingsAccount" ADD CONSTRAINT "SavingsAccount_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharesAccount" ADD CONSTRAINT "SharesAccount_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberLedger" ADD CONSTRAINT "MemberLedger_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberLedger" ADD CONSTRAINT "MemberLedger_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberLedger" ADD CONSTRAINT "MemberLedger_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
