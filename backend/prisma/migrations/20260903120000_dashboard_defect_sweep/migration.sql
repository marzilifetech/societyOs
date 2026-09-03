-- Dashboard defect sweep (2026-09-03)
--
-- 1. infra_incidents: the admin "Report Incident" form has always collected a
--    title and a severity. The DTO never declared them, so the global
--    ValidationPipe (forbidNonWhitelisted: true) rejected every submission
--    with 400. Persist them instead of dropping them.
ALTER TABLE "infra_incidents" ADD COLUMN "title" TEXT;
ALTER TABLE "infra_incidents" ADD COLUMN "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "infra_incidents" ADD COLUMN "resolvedBy" TEXT;

-- 2. guest_parking_logs: admin/security-logged guest vehicles. The dashboard's
--    "Log Guest Parking" button posted to /parking/guest, which is
--    @Roles(RESIDENT) and resolves a Resident profile from the caller, so it
--    403'd for every admin. Guest parking now has its own record with an
--    occupancy lifecycle the Parking availability view can read.
CREATE TABLE "guest_parking_logs" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "slotId" TEXT,
    "vehiclePlate" TEXT NOT NULL,
    "visitorName" TEXT,
    "flatLabel" TEXT,
    "notes" TEXT,
    "loggedById" TEXT NOT NULL,
    "entryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_parking_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "guest_parking_logs_societyId_exitAt_idx" ON "guest_parking_logs" ("societyId", "exitAt");
CREATE INDEX "guest_parking_logs_societyId_vehiclePlate_idx" ON "guest_parking_logs" ("societyId", "vehiclePlate");

ALTER TABLE "guest_parking_logs"
  ADD CONSTRAINT "guest_parking_logs_societyId_fkey"
  FOREIGN KEY ("societyId") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "guest_parking_logs"
  ADD CONSTRAINT "guest_parking_logs_slotId_fkey"
  FOREIGN KEY ("slotId") REFERENCES "parking_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
