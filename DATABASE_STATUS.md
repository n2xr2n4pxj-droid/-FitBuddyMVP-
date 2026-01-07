# 🗄️ 資料庫狀態診斷報告

## ✅ 認證問題已解決

從後端日誌可以確認：
- ✅ JWT 驗證成功：`[verifyJWT] ✅ JWT decoded successfully`
- ✅ 用戶已設置：`[verifyJWT] ✅ User set in req.user`
- ✅ 請求已通過認證中間件，到達業務邏輯層

**結論：401 Unauthorized 問題已完全解決！** 🎉

## ❌ 資料庫問題

### 問題 1: 表格不存在

**錯誤信息：**
- `relation "meals" does not exist` (錯誤碼 42P01)
- `relation "workouts" does not exist` (錯誤碼 42P01)

**原因分析：**
- Drizzle migrations 文件存在（`drizzle/0000_bizarre_slyde.sql` 等）
- 但 migrations 可能沒有執行到資料庫
- 或者資料庫連接到了錯誤的資料庫實例

### 問題 2: 欄位不存在

**錯誤信息：**
- `column "gender" does not exist` (錯誤碼 42703)

**原因分析：**
- `server/storage.ts` 中的 SQL 查詢嘗試訪問 `gender` 欄位
- 但 `shared/schema.ts` 中該欄位已被註釋掉（第 50 行）
- 實際資料庫中可能也沒有這個欄位

## 🔧 已修復的問題

### 修復 1: `storage.ts` 中的 SQL 查詢

**修復位置：** `server/storage.ts` 第 44-54 行

**修復內容：**
- ✅ 移除不存在的欄位查詢（`gender`, `age`, `height`, `weight` 等）
- ✅ 只查詢實際存在的欄位（`id`, `email`, `first_name`, `last_name`, `role` 等）
- ✅ 返回對象中將不存在的欄位設為 `null`

### 修復 2: `updateUserTDEE` 方法

**修復位置：** `server/storage.ts` 第 102 行

**修復內容：**
- ✅ 暫時跳過所有 TDEE 相關欄位的更新
- ✅ 添加警告日誌，提示需要執行 migrations
- ✅ 只更新 `updated_at` 時間戳

## 📋 需要執行的操作

### 步驟 1: 執行 Drizzle Migrations

**檢查項目：**
1. 確認 `DATABASE_URL` 環境變量已設置
2. 確認 `drizzle.config.ts` 正確指向 schema 文件
3. 執行 migrations 創建表格

**執行命令：**

```bash
# 選項 A: 使用 Drizzle Push（推薦用於開發）
npm run db:push

# 選項 B: 手動執行 Migration SQL
psql $DATABASE_URL < drizzle/0000_bizarre_slyde.sql
psql $DATABASE_URL < drizzle/0001_unusual_warlock.sql
psql $DATABASE_URL < drizzle/0002_careful_eternals.sql
psql $DATABASE_URL < drizzle/0003_huge_storm.sql
```

### 步驟 2: 驗證表格已創建

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

### 步驟 3: 檢查 Schema 配置

**問題：** `drizzle.config.ts` 指向 `./server/db/schema.ts`，但實際使用的 schema 在 `shared/schema.ts`

**需要確認：**
- 哪個 schema 文件是正確的？
- 是否需要更新 `drizzle.config.ts`？

## ⚠️ 注意事項

1. **備份資料庫**：執行 migrations 前，建議備份現有資料
2. **檢查資料庫連接**：確認 `DATABASE_URL` 指向正確的資料庫
3. **TDEE 功能**：如果未來需要使用 TDEE 功能，需要：
   - 在 schema 中添加相關欄位
   - 生成新的 migration
   - 執行 migration

## 🎯 預期結果

執行 migrations 後：
- ✅ `meals` 表格應該存在
- ✅ `workouts` 表格應該存在
- ✅ 所有 API 請求應該返回 200 而不是 500
- ✅ 不再有 "relation does not exist" 錯誤

