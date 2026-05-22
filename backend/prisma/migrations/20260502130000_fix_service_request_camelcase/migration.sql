-- Rename snake_case columns added by 20260502000000_service_request_scheduling
-- to camelCase to match the Prisma schema (which has no @map annotations).
-- Idempotent: skips rename if the camelCase column already exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_requests' AND column_name = 'preferred_time')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_requests' AND column_name = 'preferredTime') THEN
    ALTER TABLE "service_requests" RENAME COLUMN "preferred_time" TO "preferredTime";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_requests' AND column_name = 'scheduled_time')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_requests' AND column_name = 'scheduledTime') THEN
    ALTER TABLE "service_requests" RENAME COLUMN "scheduled_time" TO "scheduledTime";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_requests' AND column_name = 'confirmed_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_requests' AND column_name = 'confirmedAt') THEN
    ALTER TABLE "service_requests" RENAME COLUMN "confirmed_at" TO "confirmedAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_requests' AND column_name = 'dispute_reason')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_requests' AND column_name = 'disputeReason') THEN
    ALTER TABLE "service_requests" RENAME COLUMN "dispute_reason" TO "disputeReason";
  END IF;
END $$;
