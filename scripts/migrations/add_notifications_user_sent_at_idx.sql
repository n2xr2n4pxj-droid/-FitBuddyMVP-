-- PR-6b: GET /api/notifications/my — user_id + sent_at DESC cursor
-- 執行：psql "$DATABASE_URL" -f scripts/migrations/add_notifications_user_sent_at_idx.sql

CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_user_sent_at_idx
  ON notifications (user_id, sent_at DESC);

ANALYZE notifications;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'notifications'
  AND indexname = 'notifications_user_sent_at_idx';
