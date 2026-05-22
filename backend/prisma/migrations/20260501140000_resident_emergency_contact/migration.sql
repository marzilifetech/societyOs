-- AlterTable
ALTER TABLE "residents" ADD COLUMN IF NOT EXISTS "emergencyContact" JSONB;
