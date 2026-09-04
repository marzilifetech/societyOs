-- Staff app completion evidence (2026-09-04)
--
-- Housekeeping and laundry staff have always captured photos and counts when
-- finishing a job, but the API had nowhere to put them:
--
--   * housekeeping: the app POSTs beforePhotoUrl / afterPhotoUrl / notes with
--     the status change, but UpdateHousekeepingStatusDto declared only
--     `status`. With the global ValidationPipe running
--     forbidNonWhitelisted:true, the entire request was rejected 400 — so the
--     job could not be completed at all and the photos were lost.
--   * laundry: markPickedUp() took no @Body() at all, so the pickup photo and
--     garment count were accepted by HTTP and silently dropped on the floor.
--     (It also never set pickedUpAt.)
ALTER TABLE "housekeeping_requests" ADD COLUMN "beforePhotoUrl" TEXT;
ALTER TABLE "housekeeping_requests" ADD COLUMN "afterPhotoUrl" TEXT;
ALTER TABLE "housekeeping_requests" ADD COLUMN "completionNotes" TEXT;
ALTER TABLE "housekeeping_requests" ADD COLUMN "completedAt" TIMESTAMP(3);

ALTER TABLE "laundry_bookings" ADD COLUMN "pickupPhotoUrl" TEXT;
