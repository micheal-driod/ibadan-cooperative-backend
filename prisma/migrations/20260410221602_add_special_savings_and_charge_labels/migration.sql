/*
  Warnings:

  - The values [CHARGES_FINES] on the enum `LedgerEntryType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "LedgerEntryType_new" AS ENUM ('SAVINGS', 'SPECIAL_SAVINGS', 'SHARES', 'LOAN_COLLECTED', 'LOAN_REPAYMENT', 'LOAN_INTEREST_DEDUCTION', 'CHARGES', 'FINES', 'ADJUSTMENT');
ALTER TABLE "MemberLedger" ALTER COLUMN "entry_type" TYPE "LedgerEntryType_new" USING ("entry_type"::text::"LedgerEntryType_new");
ALTER TYPE "LedgerEntryType" RENAME TO "LedgerEntryType_old";
ALTER TYPE "LedgerEntryType_new" RENAME TO "LedgerEntryType";
DROP TYPE "public"."LedgerEntryType_old";
COMMIT;

-- AlterTable
ALTER TABLE "MemberLedger" ADD COLUMN     "entry_label" TEXT;

-- AlterTable
ALTER TABLE "SavingsAccount" ADD COLUMN     "special_savings_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "total_special_contributed" DECIMAL(15,2) NOT NULL DEFAULT 0;
