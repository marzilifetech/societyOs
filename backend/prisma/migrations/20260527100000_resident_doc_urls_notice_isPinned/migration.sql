-- Resident document URLs (separate from idProof/addressProof for Aadhaar/PAN clarity)
ALTER TABLE "residents" ADD COLUMN IF NOT EXISTS "aadhaarUrl" TEXT;
ALTER TABLE "residents" ADD COLUMN IF NOT EXISTS "panUrl" TEXT;

-- Notice.isPinned was already added to the Prisma schema but never had a
-- standalone migration; ensure the column exists for any environment that
-- was bootstrapped before the prisma db push.
ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT false;
