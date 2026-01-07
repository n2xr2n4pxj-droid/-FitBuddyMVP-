# ❌ Integer Out of Range 錯誤診斷

## 🔴 錯誤信息

```
error: integer out of range
code: '22003'
file: 'int8.c'
line: '1299'
routine: 'int84'
```

## 🔍 問題原因

### PostgreSQL Integer 範圍限制

**Integer 類型範圍：**
- 最小值：`-2,147,483,648`
- 最大值：`2,147,483,647`

**錯誤原因：**
當嘗試將 `varchar` 欄位轉換為 `integer` 時：
- 如果 `user_id` 值超出 integer 範圍
- 或者 `user_id` 值不是有效的整數字符串
- 會導致 "integer out of range" 錯誤

### 可能的情況

1. **UUID 格式的 user_id**：
   - 如果 `user_id` 是 UUID 字符串（如 `"550e8400-e29b-41d4-a716-446655440000"`）
   - 無法轉換為 integer

2. **超出範圍的數值**：
   - 如果 `user_id` 是很大的數字字符串（如 `"9999999999"`）
   - 超出 integer 範圍

3. **非數字字符串**：
   - 如果 `user_id` 包含非數字字符

## ✅ 解決方案

### 步驟 1: 檢查現有數據

```sql
-- 檢查 user_id 的類型和值
SELECT 
  table_name,
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_name IN ('meals', 'workouts', 'progress_entries', 'activity_logs')
  AND column_name = 'user_id';

-- 檢查實際值
SELECT user_id, pg_typeof(user_id), LENGTH(user_id::text) as length
FROM meals
WHERE user_id IS NOT NULL
LIMIT 10;
```

### 步驟 2: 檢查值是否在範圍內

```sql
-- 檢查是否可以轉換為 integer
SELECT 
  user_id,
  CASE 
    WHEN user_id ~ '^[0-9]+$' THEN 'numeric'
    ELSE 'non-numeric'
  END as type_check,
  CASE 
    WHEN user_id ~ '^[0-9]+$' AND user_id::bigint > 2147483647 THEN 'TOO_LARGE'
    WHEN user_id ~ '^[0-9]+$' AND user_id::bigint < -2147483648 THEN 'TOO_SMALL'
    WHEN user_id ~ '^[0-9]+$' THEN 'OK'
    ELSE 'INVALID'
  END as range_check
FROM meals
WHERE user_id IS NOT NULL;
```

### 步驟 3: 清理無效數據

如果發現問題數據：

```sql
-- 刪除無效的 user_id 記錄（如果 user_id 不是有效的整數）
DELETE FROM meals 
WHERE user_id IS NOT NULL 
  AND (user_id !~ '^[0-9]+$' OR user_id::bigint > 2147483647 OR user_id::bigint < -2147483648);

-- 對其他表格執行相同操作
DELETE FROM workouts WHERE ...;
DELETE FROM progress_entries WHERE ...;
DELETE FROM activity_logs WHERE ...;
```

### 步驟 4: 更新 user_id 值

如果 `user_id` 是字符串格式的數字，需要確保它們對應有效的 `users.id`：

```sql
-- 檢查是否有 user_id 不存在於 users 表中
SELECT DISTINCT m.user_id
FROM meals m
LEFT JOIN users u ON m.user_id::text = u.id::text
WHERE u.id IS NULL;
```

### 步驟 5: 手動執行類型轉換

如果數據清理完成，可以手動執行 migration：

```sql
-- 先轉換為 bigint（如果值很大）
ALTER TABLE meals ALTER COLUMN user_id TYPE bigint USING user_id::bigint;
ALTER TABLE meals ALTER COLUMN user_id TYPE integer USING user_id::integer;

-- 或者直接轉換（如果值在範圍內）
ALTER TABLE meals ALTER COLUMN user_id TYPE integer USING user_id::integer;
```

## 🎯 推薦執行步驟

1. **檢查數據**：確認所有 `user_id` 值都是有效的整數且在範圍內
2. **清理數據**：刪除或修復無效的 `user_id` 值
3. **驗證關聯**：確保所有 `user_id` 都對應 `users.id` 中存在的值
4. **重新執行**：`npm run db:push`

## ⚠️ 注意事項

- **數據備份**：執行任何數據修改前務必備份
- **外鍵約束**：確保 `user_id` 值都對應有效的 `users.id`
- **類型一致性**：確保所有表格的 `user_id` 類型一致

