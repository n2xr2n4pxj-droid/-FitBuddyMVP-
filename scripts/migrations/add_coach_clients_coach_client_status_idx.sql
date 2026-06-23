-- PR-3: coach_clients ReBAC 三欄 filter 複合索引
-- 執行：psql "$DATABASE_URL" -f scripts/migrations/add_coach_clients_coach_client_status_idx.sql

CREATE INDEX CONCURRENTLY IF NOT EXISTS coach_clients_coach_client_status_idx
  ON coach_clients (coach_id, client_id, status);

ANALYZE coach_clients;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'coach_clients'
  AND indexname = 'coach_clients_coach_client_status_idx';
