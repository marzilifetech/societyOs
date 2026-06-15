-- Add readAt column for inbox unread tracking.
ALTER TABLE "notification_logs" ADD COLUMN "readAt" TIMESTAMP(3);

-- Replace the bare userId index with a (userId, createdAt DESC) composite
-- so inbox list paginates without a sort step, and add (userId, readAt)
-- for fast unread-count queries.
DROP INDEX IF EXISTS "notification_logs_userId_idx";
CREATE INDEX "notification_logs_userId_createdAt_idx" ON "notification_logs" ("userId", "createdAt" DESC);
CREATE INDEX "notification_logs_userId_readAt_idx" ON "notification_logs" ("userId", "readAt");
