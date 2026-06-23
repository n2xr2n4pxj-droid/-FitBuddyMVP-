-- PR-4: plan_assignments learner list / dashboard 排序索引
-- 執行：psql "$DATABASE_URL" -f scripts/migrations/add_plan_assignments_learner_assigned_at_idx.sql

CREATE INDEX CONCURRENTLY IF NOT EXISTS plan_assignments_learner_assigned_at_idx
  ON plan_assignments (learner_id, assigned_at DESC);

ANALYZE plan_assignments;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'plan_assignments'
  AND indexname = 'plan_assignments_learner_assigned_at_idx';
