# DB Push 錯誤根本原因分析

## 錯誤詳情
```
error: integer out of range
code: '22003'
發生時機：drizzle-kit 嘗試添加 users_email_unique unique constraint
```

## 根本原因

### 問題 1：Migration 文件包含不必要的 ALTER TABLE 語句

**發現**：
- Migration 文件 `drizzle/0004_lean_nightshade.sql` 第 17-39 行包含多個 `ALTER TABLE ... ALTER COLUMN ... SET DATA TYPE integer;` 語句
- **但所有相關欄位都已經是 `integer` 類型**
- 當 PostgreSQL 嘗試將已經是 integer 的欄位"轉換"為 integer 時，可能會觸發內部驗證邏輯

**測試結果**：
- ✅ 手動執行 `ALTER TABLE activity_logs ALTER COLUMN user_id SET DATA TYPE integer;` 成功（無錯誤）
- ✅ 所有 ID 欄位都已經是 integer 類型
- ✅ 沒有發現需要轉換的 varchar 欄位

### 問題 2：drizzle-kit 的執行順序問題

**可能的原因**：
1. drizzle-kit 在執行 migration 時，可能會先驗證 schema 差異
2. 在驗證過程中，可能會嘗試執行某些轉換操作
3. 當多個 ALTER TABLE 語句連續執行時，可能會觸發某些內部檢查
4. 錯誤發生在添加 unique constraint 之前，說明問題可能在於：
   - drizzle-kit 在執行 ALTER TABLE 語句時觸發了錯誤
   - 或者 drizzle-kit 在驗證 schema 時發現了問題

### 問題 3：可能的觸發點

雖然手動執行單個 ALTER TABLE 語句成功，但 drizzle-kit 在批量執行時可能會：
1. 在執行前進行 schema 驗證
2. 嘗試計算或驗證某些值
3. 在驗證過程中觸發 integer 範圍檢查

## 解決方案

### 方案 1：移除不必要的 ALTER TABLE 語句（最推薦）

由於所有欄位都已經是 integer 類型，可以從 migration 文件中移除這些語句：

```sql
-- 移除以下語句（第 17-39 行）：
ALTER TABLE "activity_logs" ALTER COLUMN "user_id" SET DATA TYPE integer;
ALTER TABLE "coach_client_relationships" ALTER COLUMN "coach_id" SET DATA TYPE integer;
ALTER TABLE "coach_client_relationships" ALTER COLUMN "client_id" SET DATA TYPE integer;
ALTER TABLE "coach_clients" ALTER COLUMN "coach_id" SET DATA TYPE integer;
ALTER TABLE "coach_clients" ALTER COLUMN "client_id" SET DATA TYPE integer;
ALTER TABLE "friend_requests" ALTER COLUMN "sender_id" SET DATA TYPE integer;
ALTER TABLE "friend_requests" ALTER COLUMN "receiver_id" SET DATA TYPE integer;
ALTER TABLE "friendships" ALTER COLUMN "user1_id" SET DATA TYPE integer;
ALTER TABLE "friendships" ALTER COLUMN "user2_id" SET DATA TYPE integer;
ALTER TABLE "invitations" ALTER COLUMN "sender_id" SET DATA TYPE integer;
ALTER TABLE "invitations" ALTER COLUMN "receiver_id" SET DATA TYPE integer;
ALTER TABLE "meals" ALTER COLUMN "user_id" SET DATA TYPE integer;
ALTER TABLE "progress_entries" ALTER COLUMN "user_id" SET DATA TYPE integer;
ALTER TABLE "workout_plans" ALTER COLUMN "coach_id" SET DATA TYPE integer;
ALTER TABLE "workout_plans" ALTER COLUMN "client_id" SET DATA TYPE integer;
ALTER TABLE "workouts" ALTER COLUMN "user_id" SET DATA TYPE integer;
```

### 方案 2：使用條件語句

如果必須保留這些語句，可以添加條件檢查：

```sql
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'activity_logs' 
        AND column_name = 'user_id' 
        AND data_type != 'integer'
    ) THEN
        ALTER TABLE "activity_logs" ALTER COLUMN "user_id" SET DATA TYPE integer;
    END IF;
END $$;
```

### 方案 3：重新生成 Migration

1. 刪除當前的 migration 文件
2. 確保 schema 文件與實際數據庫狀態一致
3. 重新運行 `npm run db:generate`
4. 檢查生成的 migration 文件，確保不包含不必要的轉換

## 建議的修復步驟

1. **備份數據庫**（已完成）
2. **編輯 migration 文件**：移除第 17-39 行的所有 `ALTER TABLE ... SET DATA TYPE integer;` 語句
3. **重新執行 migration**：運行 `npm run db:push`
4. **驗證結果**：確認所有變更都已正確應用

## 驗證檢查清單

- [x] 所有 ID 欄位都已經是 integer 類型
- [x] 序列值在正常範圍內（users_id_seq = 33）
- [x] 沒有重複的 email 值
- [x] users 表有 2 條記錄，ID 分別為 32 和 33
- [ ] Migration 文件已清理（待執行）

