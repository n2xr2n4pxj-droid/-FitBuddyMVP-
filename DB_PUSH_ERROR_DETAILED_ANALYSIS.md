# DB Push 錯誤詳細分析（第二次）

## 錯誤信息（仍然發生）
```
error: integer out of range
code: '22003'
發生時機：drizzle-kit 嘗試添加 users_email_unique unique constraint
```

## 關鍵發現

### 問題不在 Migration 文件本身
雖然我們已經移除了不必要的 `ALTER TABLE ... SET DATA TYPE integer;` 語句，但錯誤仍然發生。

### 錯誤發生在 drizzle-kit 的 Schema 比較階段

drizzle-kit 的 `push` 命令會：
1. 讀取 schema 文件（`server/db/schema.ts`）
2. 從數據庫拉取當前 schema
3. **比較兩者差異**
4. 生成並執行 SQL 語句

錯誤發生在第 3 步（比較階段），而不是在執行 migration 文件時。

## 可能的根本原因

### 1. email_logs 表的 NOT NULL 約束問題

Migration 文件第 41 行：
```sql
ALTER TABLE "email_logs" ADD COLUMN "recipient_email" varchar NOT NULL;
```

**問題**：
- 如果 `email_logs` 表中已經有數據
- 添加 `NOT NULL` 約束時，PostgreSQL 需要驗證所有現有行
- 如果 drizzle-kit 在驗證過程中嘗試讀取或計算某些值，可能會觸發 integer 範圍檢查

### 2. drizzle-kit 的內部驗證邏輯

drizzle-kit 在比較 schema 時可能會：
- 檢查外鍵約束的完整性
- 驗證數據類型兼容性
- 檢查索引和約束
- 在這些檢查過程中，可能會觸發某些內部計算

### 3. invitation_templates 表的外鍵約束

Migration 文件第 49 行：
```sql
ALTER TABLE "invitation_templates" ADD CONSTRAINT "invitation_templates_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
```

**可能問題**：
- 如果 `invitation_templates` 表已存在但沒有外鍵約束
- drizzle-kit 在添加外鍵約束前，可能會驗證所有 `coach_id` 值
- 如果某些值超出範圍或格式不正確，會觸發錯誤

## 診斷步驟

### 步驟 1：檢查 email_logs 表
```sql
SELECT COUNT(*) FROM email_logs;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'email_logs' 
AND column_name IN ('recipient_email', 'to');
```

### 步驟 2：檢查 invitation_templates 表
```sql
SELECT COUNT(*) FROM invitation_templates;
SELECT coach_id, pg_typeof(coach_id) 
FROM invitation_templates 
WHERE coach_id IS NOT NULL;
```

### 步驟 3：檢查所有外鍵約束
```sql
SELECT conname, contype, conrelid::regclass as table_name, 
       confrelid::regclass as referenced_table
FROM pg_constraint 
WHERE confrelid = 'users'::regclass;
```

## 解決方案

### 方案 1：手動執行 Migration（推薦）

由於 drizzle-kit 的 `push` 命令在 schema 比較階段出現問題，可以手動執行 migration 文件中的 SQL 語句：

1. **備份數據庫**（已完成）
2. **手動執行必要的 SQL 語句**：
   - 創建 `invitation_templates` 表（如果不存在）
   - 添加必要的欄位
   - 創建索引和約束
   - 刪除不需要的欄位

### 方案 2：修復 email_logs 表的 NOT NULL 約束

如果 `email_logs` 表有數據，需要先處理 `recipient_email` 欄位：

```sql
-- 如果 recipient_email 不存在，先添加為可空欄位
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS recipient_email varchar;

-- 為現有數據設置默認值
UPDATE email_logs SET recipient_email = COALESCE("to", 'unknown@example.com') WHERE recipient_email IS NULL;

-- 然後設置為 NOT NULL
ALTER TABLE email_logs ALTER COLUMN recipient_email SET NOT NULL;
```

### 方案 3：使用 drizzle-kit migrate 而不是 push

`drizzle-kit push` 會自動比較 schema，而 `drizzle-kit migrate` 會執行 migration 文件：

```bash
npm run db:migrate  # 如果有的話
```

或者手動執行 migration 文件。

## 下一步操作

1. **檢查 email_logs 表的狀態**
2. **檢查 invitation_templates 表的狀態**
3. **手動執行 migration 文件中的 SQL 語句**
4. **驗證所有變更都已正確應用**

