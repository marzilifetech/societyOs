-- AlterTable: add scheduling fields to service_requests
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "preferred_time" TEXT;
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "scheduled_time" TIMESTAMP(3);
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "scheduled_time" TIMESTAMP(3);
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "preferred_time" TEXT;
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMP(3);
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "dispute_reason" TEXT;
