-- Missing indexes identified in performance audit

-- HousekeepingRequest: date-range filter on scheduledAt
CREATE INDEX IF NOT EXISTS "housekeeping_requests_scheduledAt_idx" ON "housekeeping_requests"("scheduledAt");

-- VendorOrder: allOrders filters by societyId
CREATE INDEX IF NOT EXISTS "vendor_orders_societyId_idx" ON "vendor_orders"("societyId");

-- CommunityPost: getPosts always filters {societyId, status: ACTIVE}
CREATE INDEX IF NOT EXISTS "community_posts_societyId_status_idx" ON "community_posts"("societyId", "status");
