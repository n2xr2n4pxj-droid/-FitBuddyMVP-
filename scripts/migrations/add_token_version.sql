-- P0-2 Migration：為 users 表加入 token_version 欄位
-- 執行：psql $DATABASE_URL -f scripts/migrations/add_token_version.sql
-- 或：npm run db:push

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'token_version';
