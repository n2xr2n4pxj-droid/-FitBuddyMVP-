# 🔧 Integer Out of Range 錯誤修復指南

## ❌ 錯誤信息

```
error: integer out of range
code: '22003'
routine: 'int84'
```

## 🔍 問題分析

### 可能的原因

1. **users.id 類型轉換問題**：
   - Migration 嘗試將 `users.id` 從 `integer` 轉換為 `serial`
   - `serial` 實際上是 `integer` + sequence，但轉換過程可能出問題

2. **序列值超出範圍**：
   - 如果 `users_id_seq` 的 `last_value` 超出 integer 範圍
   - 會導致錯誤

3. **數據值問題**：
   - 如果某些 `user_id` 值（在關聯表中）超出 integer 範圍

## ✅ 解決方案

### 方案 1: 跳過 users.id 的類型轉換（推薦）

`users.id` 已經是 `integer` 類型，不需要轉換為 `serial`。可以：

1. **手動編輯 migration 文件**，移除這兩行：
   ```sql
   ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE serial;
   ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;
   ```

2. **或者直接執行其他 migration 語句**，跳過 users.id 的轉換

### 方案 2: 檢查並修復序列

```sql
-- 檢查序列當前值
SELECT last_value FROM users_id_seq;

-- 如果值超出範圍，重置序列
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
```

### 方案 3: 手動執行 Migration（跳過問題語句）

```bash
# 編輯 drizzle/0004_lean_nightshade.sql
# 註釋掉或刪除 users.id 相關的 ALTER 語句
# 然後手動執行
export DATABASE_URL=$(grep DATABASE_URL server/.env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')
psql "$DATABASE_URL" < drizzle/0004_lean_nightshade.sql
```

## 🎯 推薦操作

### 步驟 1: 檢查 users.id 當前狀態

```sql
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'id';
```

### 步驟 2: 如果已經是 integer，跳過轉換

編輯 `drizzle/0004_lean_nightshade.sql`，註釋掉：
```sql
-- ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE serial;
-- ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;
```

### 步驟 3: 手動執行 Migration

```bash
export DATABASE_URL=$(grep DATABASE_URL server/.env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')
psql "$DATABASE_URL" < drizzle/0004_lean_nightshade.sql
```

## ⚠️ 注意事項

- `serial` 和 `integer` 在 PostgreSQL 中實際上是相同的
- `serial` 只是 `integer` + 自動創建的 sequence
- 如果 `users.id` 已經是 `integer` 且有 sequence，不需要轉換

