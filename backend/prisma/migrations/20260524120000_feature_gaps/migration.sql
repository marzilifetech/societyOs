-- Add INACTIVE to UserStatus
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';

-- Service request: multi-staff assignment + reminder tracking
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "assignedToIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);

UPDATE "service_requests"
SET "assignedToIds" = ARRAY["assignedToId"]
WHERE "assignedToId" IS NOT NULL AND cardinality("assignedToIds") = 0;

ALTER TABLE "service_requests" DROP CONSTRAINT IF EXISTS "service_requests_assignedToId_fkey";
ALTER TABLE "service_requests" DROP COLUMN IF EXISTS "assignedToId";
