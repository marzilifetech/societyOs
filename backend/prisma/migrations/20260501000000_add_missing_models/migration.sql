-- Migration: add_missing_models
-- Adds: MedicationDose, PostLike, HousekeepingRequest, PestControlSchedule,
--       CanteenPreOrder, Vendor, VendorOrder

-- ── MedicationDose ───────────────────────────────────────────────────────────

CREATE TABLE "medication_doses" (
    "id"           TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "date"         TIMESTAMP(3) NOT NULL,
    "slot"         TEXT NOT NULL,
    "taken"        BOOLEAN NOT NULL DEFAULT FALSE,
    "takenAt"      TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_doses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "medication_doses_medicationId_date_slot_key"
    ON "medication_doses" ("medicationId", "date", "slot");

CREATE INDEX "medication_doses_medicationId_date_idx"
    ON "medication_doses" ("medicationId", "date");

ALTER TABLE "medication_doses"
    ADD CONSTRAINT "medication_doses_medicationId_fkey"
    FOREIGN KEY ("medicationId") REFERENCES "medications" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── PostLike ─────────────────────────────────────────────────────────────────

CREATE TABLE "post_likes" (
    "id"         TEXT NOT NULL,
    "postId"     TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "post_likes_postId_residentId_key"
    ON "post_likes" ("postId", "residentId");

ALTER TABLE "post_likes"
    ADD CONSTRAINT "post_likes_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "community_posts" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "post_likes"
    ADD CONSTRAINT "post_likes_residentId_fkey"
    FOREIGN KEY ("residentId") REFERENCES "residents" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── HousekeepingRequest ───────────────────────────────────────────────────────

CREATE TABLE "housekeeping_requests" (
    "id"          TEXT NOT NULL,
    "residentId"  TEXT NOT NULL,
    "societyId"   TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "notes"       TEXT,
    "status"      TEXT NOT NULL DEFAULT 'PENDING',
    "staffId"     TEXT,
    "rating"      INTEGER,
    "review"      TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "housekeeping_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "housekeeping_requests_residentId_idx"
    ON "housekeeping_requests" ("residentId");

CREATE INDEX "housekeeping_requests_societyId_status_idx"
    ON "housekeeping_requests" ("societyId", "status");

ALTER TABLE "housekeeping_requests"
    ADD CONSTRAINT "housekeeping_requests_residentId_fkey"
    FOREIGN KEY ("residentId") REFERENCES "residents" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "housekeeping_requests"
    ADD CONSTRAINT "housekeeping_requests_societyId_fkey"
    FOREIGN KEY ("societyId") REFERENCES "societies" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── PestControlSchedule ───────────────────────────────────────────────────────

CREATE TABLE "pest_control_schedules" (
    "id"          TEXT NOT NULL,
    "societyId"   TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "areas"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notes"       TEXT,
    "status"      TEXT NOT NULL DEFAULT 'SCHEDULED',
    "completedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pest_control_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pest_control_schedules_societyId_scheduledAt_idx"
    ON "pest_control_schedules" ("societyId", "scheduledAt");

ALTER TABLE "pest_control_schedules"
    ADD CONSTRAINT "pest_control_schedules_societyId_fkey"
    FOREIGN KEY ("societyId") REFERENCES "societies" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── CanteenPreOrder ───────────────────────────────────────────────────────────

CREATE TABLE "canteen_pre_orders" (
    "id"          TEXT NOT NULL,
    "residentId"  TEXT NOT NULL,
    "societyId"   TEXT NOT NULL,
    "items"       JSONB NOT NULL,
    "totalAmount" DECIMAL(10, 2) NOT NULL,
    "pickupAt"    TIMESTAMP(3) NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'PENDING',
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canteen_pre_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "canteen_pre_orders_residentId_idx"
    ON "canteen_pre_orders" ("residentId");

CREATE INDEX "canteen_pre_orders_societyId_pickupAt_idx"
    ON "canteen_pre_orders" ("societyId", "pickupAt");

ALTER TABLE "canteen_pre_orders"
    ADD CONSTRAINT "canteen_pre_orders_residentId_fkey"
    FOREIGN KEY ("residentId") REFERENCES "residents" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "canteen_pre_orders"
    ADD CONSTRAINT "canteen_pre_orders_societyId_fkey"
    FOREIGN KEY ("societyId") REFERENCES "societies" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Vendor ────────────────────────────────────────────────────────────────────

CREATE TABLE "vendors" (
    "id"        TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "category"  TEXT NOT NULL,
    "phone"     TEXT,
    "logoUrl"   TEXT,
    "isActive"  BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vendors_societyId_category_idx"
    ON "vendors" ("societyId", "category");

ALTER TABLE "vendors"
    ADD CONSTRAINT "vendors_societyId_fkey"
    FOREIGN KEY ("societyId") REFERENCES "societies" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── VendorOrder ───────────────────────────────────────────────────────────────

CREATE TABLE "vendor_orders" (
    "id"          TEXT NOT NULL,
    "vendorId"    TEXT NOT NULL,
    "residentId"  TEXT NOT NULL,
    "societyId"   TEXT NOT NULL,
    "items"       JSONB NOT NULL,
    "totalAmount" DECIMAL(10, 2) NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'PENDING',
    "notes"       TEXT,
    "deliveryAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vendor_orders_residentId_idx"
    ON "vendor_orders" ("residentId");

CREATE INDEX "vendor_orders_vendorId_status_idx"
    ON "vendor_orders" ("vendorId", "status");

ALTER TABLE "vendor_orders"
    ADD CONSTRAINT "vendor_orders_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "vendors" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_orders"
    ADD CONSTRAINT "vendor_orders_residentId_fkey"
    FOREIGN KEY ("residentId") REFERENCES "residents" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_orders"
    ADD CONSTRAINT "vendor_orders_societyId_fkey"
    FOREIGN KEY ("societyId") REFERENCES "societies" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
