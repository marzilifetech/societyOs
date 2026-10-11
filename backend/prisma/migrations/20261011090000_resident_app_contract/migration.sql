-- Resident app contract fixes (2026-10-11)
--
-- The shipped resident app sends fields the API had nowhere to put, so the
-- strict validation pipe rejected the whole request:
--   * complaints: a photo attached to a complaint (`photoUrl`) made every
--     complaint with a photo a 400.
--   * domestic help: "gate access" on a helper, and "Log payment" for a
--     helper's salary, which answered "recorded" and stored nothing.
-- All additive; existing rows are unaffected.
ALTER TABLE "complaints" ADD COLUMN "photoUrl" TEXT;

ALTER TABLE "domestic_helps" ADD COLUMN "gateAccess" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "domestic_help_payments" (
    "id" TEXT NOT NULL,
    "domesticHelpId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "domestic_help_payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "domestic_help_payments_domesticHelpId_paidAt_idx" ON "domestic_help_payments"("domesticHelpId", "paidAt");
ALTER TABLE "domestic_help_payments" ADD CONSTRAINT "domestic_help_payments_domesticHelpId_fkey" FOREIGN KEY ("domesticHelpId") REFERENCES "domestic_helps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- family members: the app collects date of birth, blood group and an
-- emergency-contact flag, and lets phone be blank (children, elders). Every
-- add was a 400 because these fields were unknown and phone was required.
ALTER TABLE "family_members" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "family_members" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "family_members" ADD COLUMN "bloodGroup" TEXT;
ALTER TABLE "family_members" ADD COLUMN "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false;

-- subscriptions: "Cancel" only paused the subscription; it needs its own state.
ALTER TABLE "subscriptions" ADD COLUMN "cancelledAt" TIMESTAMP(3);
