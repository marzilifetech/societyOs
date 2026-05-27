-- Society lifecycle: status enum, suspension, optional contact, short code.
-- Idempotent: safe to re-apply.

-- 1. Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SocietyStatus') THEN
    CREATE TYPE "SocietyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
  END IF;
END $$;

-- 2. Columns
ALTER TABLE "societies"
  ADD COLUMN IF NOT EXISTS "status"           "SocietyStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "suspendedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspendedReason"  TEXT,
  ADD COLUMN IF NOT EXISTS "suspendedById"    TEXT,
  ADD COLUMN IF NOT EXISTS "shortCode"        TEXT,
  ADD COLUMN IF NOT EXISTS "contactEmail"     TEXT,
  ADD COLUMN IF NOT EXISTS "contactPhone"     TEXT;

-- 3. Backfill: rows with archivedAt set are ARCHIVED; everything else stays ACTIVE.
UPDATE "societies"
SET    "status" = 'ARCHIVED'
WHERE  "archivedAt" IS NOT NULL
  AND  "status" = 'ACTIVE';

-- 4. Indexes & uniques
CREATE INDEX IF NOT EXISTS "societies_status_idx" ON "societies"("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'societies_shortCode_key'
  ) THEN
    CREATE UNIQUE INDEX "societies_shortCode_key" ON "societies"("shortCode");
  END IF;
END $$;
