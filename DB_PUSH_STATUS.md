# 📊 DB Push 狀態報告

## ❌ 初始錯誤

```
error: invalid input value for enum role: "client"
code: '22P02'
```

## 🔍 問題原因

### 數據不匹配

**資料庫中的實際值：**
- `role = "client"` (小寫)
- `role = "coach"` (小寫)

**Schema 定義的 Enum 值：**
- `['USER', 'COACH', 'BOTH', 'ADMIN']` (大寫)

**問題：**
- `"client"` 不在 enum 值列表中
- PostgreSQL enum 是大小寫敏感的
- 當 drizzle-kit 嘗試將 `text` 轉換為 `role` enum 時失敗

## ✅ 修復步驟

### 步驟 1: 更新現有數據

將所有小寫的 role 值更新為大寫：

```sql
UPDATE users SET role = 'USER' WHERE role = 'client';
UPDATE users SET role = 'COACH' WHERE role = 'coach';
```

### 步驟 2: 驗證數據

```sql
SELECT DISTINCT role FROM users;
```

應該只看到：`USER`, `COACH`, `BOTH`, `ADMIN`（大寫）

### 步驟 3: 重新執行 db:push

```bash
npm run db:push
```

## 📋 預期結果

執行 `db:push` 後應該：

1. ✅ 成功將所有 `user_id` 欄位從 `varchar` 轉換為 `integer`
2. ✅ 成功將 `role` 欄位從 `text` 轉換為 `role` enum
3. ✅ 創建新表格和欄位
4. ✅ 建立外鍵約束
5. ✅ 不再有 500 錯誤（relation does not exist）

## ⚠️ 注意事項

1. **數據一致性**：
   - 確保所有 role 值都是大寫
   - `client` → `USER`
   - `coach` → `COACH`

2. **代碼更新**：
   - 確保應用代碼使用大寫值（USER, COACH 等）
   - 檢查所有設置 role 的地方

3. **類型轉換**：
   - `user_id` 從 `varchar` 轉為 `integer` 時，需要確保所有值都是有效的整數

## 🎯 成功指標

Migration 成功後：
- ✅ 所有表格的欄位類型正確
- ✅ 外鍵約束正確建立
- ✅ API 請求返回 200 而不是 500
- ✅ 不再有 "relation does not exist" 錯誤
- ✅ 不再有 "column does not exist" 錯誤

