-- PR-1b: workout-volume / session list 高頻查詢複合索引
-- 執行：psql "$DATABASE_URL" -f scripts/migrations/add_workout_sessions_user_completed_at_idx.sql

CREATE INDEX CONCURRENTLY IF NOT EXISTS workout_sessions_user_completed_at_idx
  ON workout_sessions (user_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

ANALYZE workout_sessions;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'workout_sessions'
  AND indexname = 'workout_sessions_user_completed_at_idx';
