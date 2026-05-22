-- Migration: prod_indexes_and_audit
-- Purpose:
--   * Add 2FA + lastActiveAt columns to users
--   * Add encrypted aadhaar + soft-delete columns to residents
--   * Add soft-delete to staff_members
--   * Drop emergencyContact from residents and travel_pauses (BRD §4.7 — StaffMember only)
--   * Harden audit_logs (extra columns + composite indexes for cursor pagination)
--   * Extend consent_logs with version + revokedAt
--   * Add hot-path composite indexes

-- ── Users ───────────────────────────────────────────────────────────────────
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "totpSecret" BYTEA,
  ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);

-- ── Residents ───────────────────────────────────────────────────────────────
ALTER TABLE "residents"
  ADD COLUMN IF NOT EXISTS "aadhaar" BYTEA,
  ADD COLUMN IF NOT EXISTS "panNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "isAnonymised" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "residents" DROP COLUMN IF EXISTS "emergencyContact";

-- ── Staff ───────────────────────────────────────────────────────────────────
ALTER TABLE "staff_members"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- ── Travel pauses ───────────────────────────────────────────────────────────
ALTER TABLE "travel_pauses" DROP COLUMN IF EXISTS "emergencyContact";

-- ── Audit log ───────────────────────────────────────────────────────────────
ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "module" TEXT,
  ADD COLUMN IF NOT EXISTS "routePath" TEXT,
  ADD COLUMN IF NOT EXISTS "method" TEXT,
  ADD COLUMN IF NOT EXISTS "ipAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

CREATE INDEX IF NOT EXISTS "audit_logs_actorId_createdAt_idx"
  ON "audit_logs" ("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_societyId_createdAt_idx"
  ON "audit_logs" ("societyId", "createdAt");

-- ── Consent log ─────────────────────────────────────────────────────────────
ALTER TABLE "consent_logs"
  ADD COLUMN IF NOT EXISTS "version" TEXT,
  ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "consent_logs_userId_action_idx"
  ON "consent_logs" ("userId", "action");

-- ── Hot-path composite indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "visitors_residentId_status_idx"
  ON "visitors" ("residentId", "status");
CREATE INDEX IF NOT EXISTS "maintenance_bills_residentId_status_idx"
  ON "maintenance_bills" ("residentId", "status");
