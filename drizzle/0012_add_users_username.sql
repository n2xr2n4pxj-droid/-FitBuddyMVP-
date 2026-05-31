-- 僅新增可為 null 的 username；舊列允許多筆 NULL，UNIQUE 不衝突
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" ("username");
