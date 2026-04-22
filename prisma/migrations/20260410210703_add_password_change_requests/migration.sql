-- CreateEnum
CREATE TYPE "PasswordChangeRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "PasswordChangeRequest" (
    "id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "current_password" TEXT NOT NULL,
    "new_password_hash" TEXT NOT NULL,
    "status" "PasswordChangeRequestStatus" NOT NULL DEFAULT 'pending',
    "admin_note" TEXT,
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordChangeRequest_member_id_idx" ON "PasswordChangeRequest"("member_id");

-- CreateIndex
CREATE INDEX "PasswordChangeRequest_reviewed_by_idx" ON "PasswordChangeRequest"("reviewed_by");

-- AddForeignKey
ALTER TABLE "PasswordChangeRequest" ADD CONSTRAINT "PasswordChangeRequest_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordChangeRequest" ADD CONSTRAINT "PasswordChangeRequest_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
