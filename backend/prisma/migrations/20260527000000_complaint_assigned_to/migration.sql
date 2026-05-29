-- H1: First-class complaint assignment. Decouples assignment from the
-- free-text `adminNote` column which was previously clobbered by every
-- assign action. Idempotent.

ALTER TABLE "complaints"
  ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;

CREATE INDEX IF NOT EXISTS "complaints_assignedToId_idx"
  ON "complaints"("assignedToId");

-- FK to staff_members (nullable). ON DELETE SET NULL keeps complaint history
-- intact if a staff member is deleted; assignment simply becomes orphaned.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'complaints_assignedToId_fkey'
  ) THEN
    ALTER TABLE "complaints"
      ADD CONSTRAINT "complaints_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "staff_members"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
