-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('active', 'completed', 'defaulted');

-- CreateTable
CREATE TABLE "Loan" (
    "id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "loan_application_id" INTEGER NOT NULL,
    "loan_type_id" INTEGER NOT NULL,
    "principal_amount" DECIMAL(15,2) NOT NULL,
    "interest_amount" DECIMAL(15,2) NOT NULL,
    "total_payable" DECIMAL(15,2) NOT NULL,
    "monthly_deduction" DECIMAL(15,2) NOT NULL,
    "duration_months" INTEGER NOT NULL,
    "remaining_balance" DECIMAL(15,2) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'active',
    "approved_by" INTEGER NOT NULL,
    "approved_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Loan_loan_application_id_key" ON "Loan"("loan_application_id");

-- CreateIndex
CREATE INDEX "Loan_member_id_idx" ON "Loan"("member_id");

-- CreateIndex
CREATE INDEX "Loan_loan_type_id_idx" ON "Loan"("loan_type_id");

-- CreateIndex
CREATE INDEX "Loan_approved_by_idx" ON "Loan"("approved_by");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_loan_type_id_fkey" FOREIGN KEY ("loan_type_id") REFERENCES "LoanType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
