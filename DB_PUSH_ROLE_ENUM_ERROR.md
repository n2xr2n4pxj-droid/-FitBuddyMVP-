# ❌ DB Push 錯誤診斷：Role Enum 不匹配

## 🔴 錯誤信息

```
error: invalid input value for enum role: "client"
code: '22P02'
```

## 🔍 問題原因

### 1. Enum 定義不匹配

**Schema 定義（`server/db/schema.ts`）：**
```typescript
export const roleEnum = pgEnum('role', ['USER', 'COACH', 'BOTH', 'ADMIN']);
```

**實際資料庫數據：**
- 資料庫中現有用戶的 `role` 值是 `"client"`
- 但 enum 定義中只有：`USER`, `COACH`, `BOTH`, `ADMIN`
- 沒有 `"client"` 這個值

### 2. 類型轉換問題

當 drizzle-kit 嘗試將 `users.role` 欄位從 `text` 轉換為 `role` enum 時：
- 現有數據：`role = "client"`
- Enum 值：`['USER', 'COACH', 'BOTH', 'ADMIN']`
- 結果：`"client"` 不在 enum 中 → 錯誤

## ✅ 解決方案

### 方案 1: 更新現有數據（推薦）

在執行 migration 前，先將所有 `"client"` 值更新為 `"USER"`：

```sql
-- 連接到資料庫
export DATABASE_URL=$(grep DATABASE_URL server/.env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')
psql "$DATABASE_URL"

-- 更新 role 值
UPDATE users SET role = 'USER' WHERE role = 'client';
UPDATE users SET role = 'COACH' WHERE role = 'coach';
UPDATE users SET role = 'BOTH' WHERE role = 'both';
UPDATE users SET role = 'ADMIN' WHERE role = 'admin';

-- 驗證
SELECT DISTINCT role FROM users;
```

### 方案 2: 修改 Schema 定義

如果希望保留 `"client"` 作為有效值，需要更新 schema：

```typescript
export const roleEnum = pgEnum('role', ['USER', 'CLIENT', 'COACH', 'BOTH', 'ADMIN']);
```

但這會導致代碼不一致，不推薦。

### 方案 3: 使用 text 類型（臨時）

暫時保持 `role` 為 `text` 類型，不轉換為 enum：

```typescript
// 在 server/db/schema.ts 中
role: text('role').notNull().default('USER'),
```

但這會失去 enum 的類型檢查優勢。

## 🎯 推薦執行步驟

### 步驟 1: 檢查現有數據

```bash
export DATABASE_URL=$(grep DATABASE_URL server/.env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')
psql "$DATABASE_URL" -c "SELECT id, email, role FROM users;"
```

### 步驟 2: 更新數據

```bash
psql "$DATABASE_URL" -c "UPDATE users SET role = 'USER' WHERE role = 'client';"
psql "$DATABASE_URL" -c "UPDATE users SET role = 'COACH' WHERE role = 'coach';"
psql "$DATABASE_URL" -c "UPDATE users SET role = UPPER(role) WHERE role != UPPER(role);"
```

### 步驟 3: 驗證

```bash
psql "$DATABASE_URL" -c "SELECT DISTINCT role FROM users;"
```

應該只看到：`USER`, `COACH`, `BOTH`, `ADMIN`（大寫）

### 步驟 4: 重新執行 db:push

```bash
npm run db:push
```

## ⚠️ 注意事項

1. **數據備份**：更新數據前務必備份
2. **大小寫敏感**：PostgreSQL enum 是大小寫敏感的
3. **代碼一致性**：確保應用代碼也使用大寫值（USER, COACH 等）

## 📋 檢查清單

- [ ] 檢查現有 role 值
- [ ] 更新所有 'client' 為 'USER'
- [ ] 更新所有小寫值為大寫
- [ ] 驗證數據正確
- [ ] 重新執行 db:push
- [ ] 驗證 migration 成功

