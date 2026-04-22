/*
  Warnings:

  - You are about to drop the column `remaining_balance` on the `Loan` table. All the data in the column will be lost.
  - You are about to drop the column `duration_months` on the `LoanType` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Loan" DROP COLUMN "remaining_balance",
ADD COLUMN     "remaining_interest_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "remaining_principal_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "remaining_total_balance" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LoanType" DROP COLUMN "duration_months",
ADD COLUMN     "max_duration_months" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "min_duration_months" INTEGER NOT NULL DEFAULT 1;
