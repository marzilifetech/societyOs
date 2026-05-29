-- Society archive support
ALTER TABLE "societies" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- Staff documents table (model existed in schema but table was never migrated)
CREATE TABLE IF NOT EXISTS "staff_documents" (
    "id" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,

    CONSTRAINT "staff_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "staff_documents_staffMemberId_idx" ON "staff_documents"("staffMemberId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_documents_staffMemberId_fkey'
  ) THEN
    ALTER TABLE "staff_documents"
      ADD CONSTRAINT "staff_documents_staffMemberId_fkey"
      FOREIGN KEY ("staffMemberId") REFERENCES "staff_members"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Add columns if table already existed from a partial deploy
ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "uploadedBy" TEXT;
ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "verifiedById" TEXT;
