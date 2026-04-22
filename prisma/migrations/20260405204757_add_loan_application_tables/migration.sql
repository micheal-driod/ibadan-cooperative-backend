/*
  Warnings:

  - The `department` column on the `Member` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "LoanApplicationStatus" AS ENUM ('submitted', 'viewed', 'approved', 'rejected', 'active', 'completed');

-- CreateEnum
CREATE TYPE "Department" AS ENUM ('ARFFS', 'AVSEC', 'COMMERCIAL', 'STORE', 'ENVIRONMENT', 'ICT', 'ACCOUNTS', 'AUDIT', 'CREDIT_CONTROL', 'SAFETY', 'OTHERS');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "grade_level" TEXT,
ADD COLUMN     "middle_name" TEXT,
ADD COLUMN     "purpose" TEXT,
DROP COLUMN "department",
ADD COLUMN     "department" "Department";

-- CreateTable
CREATE TABLE "LoanType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "interest_rate" DECIMAL(10,2) NOT NULL,
    "duration_months" INTEGER NOT NULL,
    "min_amount" DECIMAL(15,2),
    "max_amount" DECIMAL(15,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanApplication" (
    "id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "loan_type_id" INTEGER NOT NULL,
    "requested_amount" DECIMAL(15,2) NOT NULL,
    "interest_rate" DECIMAL(10,2) NOT NULL,
    "duration_months" INTEGER NOT NULL,
    "interest_amount" DECIMAL(15,2) NOT NULL,
    "total_repayment" DECIMAL(15,2) NOT NULL,
    "monthly_deduction" DECIMAL(15,2) NOT NULL,
    "loan_purpose" TEXT NOT NULL,
    "status" "LoanApplicationStatus" NOT NULL DEFAULT 'submitted',
    "rejection_reason" TEXT,
    "review_note" TEXT,
    "reviewed_by" INTEGER,
    "viewed_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanApplicationGuarantor" (
    "id" SERIAL NOT NULL,
    "loan_application_id" INTEGER NOT NULL,
    "guarantor_no" INTEGER NOT NULL,
    "full_name" TEXT NOT NULL,
    "staff_no" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "grade_level" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanApplicationGuarantor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoanType_name_key" ON "LoanType"("name");

-- CreateIndex
CREATE INDEX "LoanApplication_member_id_idx" ON "LoanApplication"("member_id");

-- CreateIndex
CREATE INDEX "LoanApplication_loan_type_id_idx" ON "LoanApplication"("loan_type_id");

-- CreateIndex
CREATE INDEX "LoanApplicationGuarantor_loan_application_id_idx" ON "LoanApplicationGuarantor"("loan_application_id");

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_loan_type_id_fkey" FOREIGN KEY ("loan_type_id") REFERENCES "LoanType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplicationGuarantor" ADD CONSTRAINT "LoanApplicationGuarantor_loan_application_id_fkey" FOREIGN KEY ("loan_application_id") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
