-- PR-2: GET /workouts/sessions/my & learner session list 排序索引
-- 執行：psql "$DATABASE_URL" -f scripts/migrations/add_workout_sessions_user_list_idx.sql

CREATE INDEX CONCURRENTLY IF NOT EXISTS workout_sessions_user_list_idx
  ON workout_sessions (user_id, completed_at DESC NULLS LAST, started_at DESC);

ANALYZE workout_sessions;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'workout_sessions'
  AND indexname = 'workout_sessions_user_list_idx';
