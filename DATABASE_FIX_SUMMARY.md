# 🔍 資料庫問題診斷與修復總結

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

**原因：**
- Drizzle migrations 可能沒有執行
- 資料庫表格尚未創建

### 問題 2: 欄位不存在

**錯誤信息：**
- `column "gender" does not exist` (錯誤碼 42703)

**原因：**
- `server/storage.ts` 中的 SQL 查詢嘗試訪問 `gender` 欄位
- 但 `shared/schema.ts` 中該欄位已被註釋掉（第 50 行）
- 實際資料庫中可能也沒有這個欄位

## 🔧 需要修復的問題

### 修復 1: 修復 `storage.ts` 中的 SQL 查詢

**問題位置：** `server/storage.ts` 第 47-49 行

**問題代碼：**
```typescript
const result = await pool.query(
  `SELECT id, email, password_hash, first_name, last_name, created_at, updated_at,
          gender, age, height, weight, body_fat, activity_level,  // ❌ 這些欄位不存在
          bmr, tdee, goal, goal_calories, goal_protein, goal_carbs, goal_fat
   FROM users 
   WHERE id = $1 
   LIMIT 1`,
  [id]
);
```

**修復方案：**
移除不存在的欄位，只查詢實際存在的欄位。

### 修復 2: 執行 Drizzle Migrations

**檢查項目：**
1. 確認 `drizzle.config.ts` 正確指向 schema 文件
2. 確認 `DATABASE_URL` 環境變量已設置
3. 執行 migrations 創建表格

## 📋 修復步驟

### 步驟 1: 修復 `storage.ts` 中的 SQL 查詢

移除不存在的欄位引用。

### 步驟 2: 檢查並執行 Migrations

1. 檢查 `DATABASE_URL` 是否正確
2. 運行 `npm run db:push` 或手動執行 migrations

### 步驟 3: 驗證資料庫結構

確認所有必要的表格和欄位都已創建。

