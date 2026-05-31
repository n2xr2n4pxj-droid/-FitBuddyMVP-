# 🎯 Schema 配置建議

## 📊 當前狀況

### 兩個 Schema 文件

1. **`shared/schema.ts`** (301 行)
   - ✅ 簡潔，核心功能
   - ✅ 大部分代碼在使用
   - ❌ 缺少教練系統表格（invitations, coachClients 等）
   - ❌ `meals.userId` 和 `workouts.userId` 是 `varchar`，但 `users.id` 是 `integer`（類型不匹配）

2. **`server/db/schema.ts`** (665 行)
   - ✅ 完整版本，包含所有表格
   - ✅ 包含教練系統所需的所有表格
   - ✅ `drizzle.config.ts` 已指向此文件
   - ❌ `meals.userId` 和 `workouts.userId` 是 `varchar`，但 `users.id` 是 `serial`（類型不匹配）

### 使用情況

#### 使用 `@shared/schema` 的文件：
- `server/db.ts` ⚠️ **核心數據庫連接**
- `server/storage.ts` ⚠️ **數據存儲層**
- `server/routes.ts` ⚠️ **主要路由**
- `server/replitAuth.ts` ⚠️ **認證系統**

#### 使用 `server/db/schema` 的文件：
- `server/services/invitationService.ts` ✅
- `server/services/emailService.ts` ✅
- `server/routes/coaches.ts` ✅
- `server/routes/workout-plans.ts` ✅

## ⚠️ 發現的問題

### 問題 1: 類型不匹配（兩個 schema 都有）

**`shared/schema.ts`:**
```typescript
users.id: integer  // ✅ 正確
meals.userId: varchar  // ❌ 應該是 integer
workouts.userId: varchar  // ❌ 應該是 integer
```

**`server/db/schema.ts`:**
```typescript
users.id: serial  // ✅ 正確（serial = integer + auto-increment）
meals.userId: varchar  // ❌ 應該是 integer
workouts.userId: varchar  // ❌ 應該是 integer
```

這會導致：
- 外鍵約束無法正確建立
- 資料庫查詢可能失敗
- 類型檢查錯誤

### 問題 2: Schema 不一致

- 核心功能使用 `shared/schema.ts`
- 教練系統使用 `server/db/schema.ts`
- 這會導致類型不一致和維護困難

## 🎯 推薦解決方案

### ✅ 推薦：統一使用 `server/db/schema.ts`

**理由：**
1. ✅ 包含完整的表格定義（支持所有功能）
2. ✅ `drizzle.config.ts` 已正確指向
3. ✅ 教練系統功能需要這些表格
4. ✅ 只需要修復類型不匹配問題

### 🔧 執行步驟

#### 步驟 1: 修復類型不匹配

在 `server/db/schema.ts` 中：
```typescript
// 修復前
userId: varchar('user_id').references(() => users.id, ...)

// 修復後
userId: integer('user_id').references(() => users.id, ...)
```

需要修復的表格：
- `meals.userId`
- `workouts.userId`
- `progressEntries.userId`
- `activityLogs.userId`
- 其他引用 `users.id` 的 `varchar` 欄位

#### 步驟 2: 更新所有引用

將所有 `@shared/schema` 引用改為 `./db/schema` 或 `../db/schema`：

```typescript
// 修復前
import { users } from '@shared/schema';

// 修復後
import { users } from './db/schema';  // 或 '../db/schema'
```

需要更新的文件：
- `server/db.ts`
- `server/storage.ts`
- `server/routes.ts`
- `server/replitAuth.ts`
- `server/routes/auth.ts`
- `server/db/queries.ts`

#### 步驟 3: 更新 `drizzle.config.ts`

確認指向正確（已正確）：
```typescript
schema: './server/db/schema.ts',  // ✅ 已正確
```

#### 步驟 4: 重新生成 Migrations

```bash
npm run db:generate
```

#### 步驟 5: 執行 Migrations

```bash
npm run db:push
```

## 📋 檢查清單

- [ ] 修復 `server/db/schema.ts` 中的類型不匹配
- [ ] 更新 `server/db.ts` 使用 `./db/schema`
- [ ] 更新所有 `@shared/schema` 引用
- [ ] 重新生成 migrations
- [ ] 執行 migrations
- [ ] 測試所有功能

## ⚠️ 注意事項

1. **備份資料庫**：執行 migrations 前務必備份
2. **類型轉換**：如果資料庫中已有 `varchar` 的 `user_id`，需要先遷移數據
3. **測試**：更新後需要全面測試所有功能

