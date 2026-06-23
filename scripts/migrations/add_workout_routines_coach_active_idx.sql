-- PR-6a: GET /api/plans/available — coach_id + deleted_at IS NULL
-- 執行：psql "$DATABASE_URL" -f scripts/migrations/add_workout_routines_coach_active_idx.sql

CREATE INDEX CONCURRENTLY IF NOT EXISTS workout_routines_coach_active_idx
  ON workout_routines (coach_id)
  WHERE deleted_at IS NULL;

ANALYZE workout_routines;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'workout_routines'
  AND indexname = 'workout_routines_coach_active_idx';
