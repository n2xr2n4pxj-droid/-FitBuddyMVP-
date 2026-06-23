-- PR-5: workout_routines upcoming list (learner view)
-- 執行：psql "$DATABASE_URL" -f scripts/migrations/add_workout_routines_client_upcoming_idx.sql

CREATE INDEX CONCURRENTLY IF NOT EXISTS workout_routines_client_upcoming_idx
  ON workout_routines (client_id, scheduled_date ASC)
  WHERE deleted_at IS NULL AND is_completed = false;

ANALYZE workout_routines;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'workout_routines'
  AND indexname = 'workout_routines_client_upcoming_idx';
