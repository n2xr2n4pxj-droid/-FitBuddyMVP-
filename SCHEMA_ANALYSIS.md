# 📊 Schema 文件分析報告

## 🔍 當前狀況

### Schema 文件位置
1. **`shared/schema.ts`** - 簡化版本（301 行）
2. **`server/db/schema.ts`** - 完整版本（665 行）

### 使用情況分析

#### ✅ 使用 `@shared/schema` 的文件：
- `server/db.ts` - **核心數據庫連接**（使用 `import * as schema`）
- `server/storage.ts` - 數據存儲層
- `server/routes.ts` - 主要路由
- `server/replitAuth.ts` - 認證系統
- `server/routes/auth.ts` - 認證路由

#### ✅ 使用 `server/db/schema` 的文件：
- `server/services/invitationService.ts` - 邀請服務
- `server/services/emailService.ts` - 郵件服務
- `server/routes/coaches.ts` - 教練路由
- `server/routes/workout-plans.ts` - 訓練計劃路由

### Drizzle 配置
- `drizzle.config.ts` 當前指向：`./server/db/schema.ts`

## ⚠️ 問題診斷

### 問題 1: Schema 不一致
- **核心功能**（meals, workouts, users）使用 `shared/schema.ts`
- **教練系統**（invitations, coachClients）使用 `server/db/schema.ts`
- **Drizzle migrations** 基於 `server/db/schema.ts` 生成

### 問題 2: 類型不匹配
- `shared/schema.ts` 中的 `users.id` 是 `integer`
- `server/db/schema.ts` 中的 `users.id` 是 `serial`（也是 integer）
- 但 `meals.userId` 和 `workouts.userId` 在兩個 schema 中都是 `varchar`，這可能導致外鍵問題

### 問題 3: 表格定義差異
- `shared/schema.ts` 只有：users, meals, workouts, tdeeHistory, sessions
- `server/db/schema.ts` 包含：所有上述表格 + invitations, coachClients, workoutPlans, emailLogs 等

## 🎯 建議解決方案

### 選項 A: 統一使用 `server/db/schema.ts`（推薦）

**優點：**
- ✅ 包含完整的表格定義
- ✅ 已包含教練系統所需的所有表格
- ✅ `drizzle.config.ts` 已正確指向
- ✅ 支持所有功能

**需要修改：**
1. 更新 `server/db.ts` 從 `@shared/schema` 改為 `./db/schema`
2. 更新所有使用 `@shared/schema` 的文件

### 選項 B: 統一使用 `shared/schema.ts`

**優點：**
- ✅ 簡潔，只包含核心功能
- ✅ 大部分代碼已在使用

**缺點：**
- ❌ 缺少教練系統表格
- ❌ 需要更新 `drizzle.config.ts`
- ❌ 需要將 `server/db/schema.ts` 的內容合併到 `shared/schema.ts`

## 🔧 推薦操作

**建議採用選項 A**，因為：
1. `server/db/schema.ts` 是完整版本
2. 教練系統功能需要這些表格
3. `drizzle.config.ts` 已正確配置
4. 只需要更新引用即可

### 執行步驟：
1. 更新 `server/db.ts` 使用 `./db/schema`
2. 更新所有 `@shared/schema` 引用為 `./db/schema` 或 `../db/schema`
3. 驗證所有功能正常

