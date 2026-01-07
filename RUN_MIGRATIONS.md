# 🗄️ 執行 Drizzle Migrations 指南

## 📋 當前狀態

### ✅ 認證問題已解決
- JWT 驗證成功
- 請求已通過認證中間件

### ❌ 資料庫問題
- `relation "meals" does not exist`
- `relation "workouts" does not exist`
- `column "gender" does not exist`

## 🔧 修復步驟

### 步驟 1: 檢查環境變量

確認 `DATABASE_URL` 已設置：

```bash
# 檢查 server/.env.local 或根目錄 .env
cat server/.env.local | grep DATABASE_URL
```

### 步驟 2: 檢查 Drizzle 配置

確認 `drizzle.config.ts` 正確指向 schema：

```typescript
// drizzle.config.ts
schema: './server/db/schema.ts',  // ✅ 或 './shared/schema.ts'
```

### 步驟 3: 執行 Migrations

**選項 A: 使用 Drizzle Push（推薦用於開發）**

```bash
npm run db:push
```

這會直接將 schema 推送到資料庫，無需手動執行 SQL。

**選項 B: 手動執行 Migration SQL**

```bash
# 連接到資料庫
psql $DATABASE_URL

# 執行所有 migrations
\i drizzle/0000_bizarre_slyde.sql
\i drizzle/0001_unusual_warlock.sql
\i drizzle/0002_careful_eternals.sql
\i drizzle/0003_huge_storm.sql
```

**選項 C: 使用 Drizzle Migrate（如果已設置）**

```bash
# 如果項目中有 migrate 腳本
npm run db:migrate
```

### 步驟 4: 驗證表格已創建

```sql
-- 連接到資料庫
psql $DATABASE_URL

-- 檢查表格是否存在
\dt

-- 應該看到：
-- meals
-- workouts
-- users
-- sessions
-- 等表格
```

## ⚠️ 注意事項

1. **備份資料庫**：執行 migrations 前，建議備份現有資料
2. **檢查 schema 文件**：確認 `server/db/schema.ts` 或 `shared/schema.ts` 包含所有必要的表格定義
3. **欄位不匹配**：如果 schema 中某些欄位被註釋掉，需要同步更新 `storage.ts` 中的 SQL 查詢

## 🔍 如果 Migrations 失敗

1. **檢查資料庫連接**：確認 `DATABASE_URL` 正確
2. **檢查權限**：確認資料庫用戶有創建表格的權限
3. **檢查衝突**：如果表格已存在但結構不同，可能需要先刪除或修改

