# Google OAuth 註冊流程修復總結

## 問題診斷

### 原始問題
1. `/api/auth/registration-status` API 返回 404 (Not Found)
2. 終端錯誤: "User not found"
3. 導致無法重定向到註冊流程，直接進入 Dashboard

### 根本原因
1. `registration-status` API 使用 `getUserById`，但 JWT token 中的 userId 格式可能不匹配
2. 如果用戶不存在，API 返回 404 而不是 `incomplete` 狀態
3. GoogleLoginButton 的錯誤處理不夠健壯

## 修復方案

### 1. 修復 `/api/auth/registration-status` API

**文件**: `server/routes/auth.ts`

**主要修復**:
- 使用與 `verifyJWT` 相同的 SQL 查詢方式（直接 SQL 查詢所有字段）
- 如果用戶不存在，返回 `incomplete` 狀態而不是 404
- 更新註冊狀態檢查邏輯，將角色選擇視為步驟 7（最後一步）

**新流程**:
- 步驟 1: 用戶名（OAuth 用戶已有）
- 步驟 2: Email/Password（OAuth 用戶已跳過）
- 步驟 3: TDEE 基本信息（年齡、性別、身高、體重）
- 步驟 4: TDEE 完整設置（活動水平、目標）
- 步驟 5: Newsletter（可選）
- 步驟 6: Sync Contacts（可選）
- 步驟 7: 角色選擇（必要，最後一步）⭐ 新增

### 2. 修復 GoogleLoginButton.tsx

**文件**: `client/src/components/GoogleLoginButton.tsx`

**主要修復**:
- 改進 token 處理（確保使用正確的 token）
- 改進錯誤處理（API 失敗時重定向到步驟 3）
- 根據註冊狀態正確重定向

### 3. 更新 OAuth 回調邏輯

**文件**: `server/routes/auth.ts`

**主要修復**:
- 移除自動角色設置（使用 schema 默認值 'USER'）
- 角色選擇將在步驟 7 完成

## 新的註冊流程

### 完整流程（7 步）

1. **步驟 1**: 用戶名（Username）
   - OAuth 用戶：已有，可視為完成
   - 重定向邏輯：OAuth 用戶跳過

2. **步驟 2**: Email/Password
   - OAuth 用戶：已跳過（OAuth 提供 email）
   - 重定向邏輯：OAuth 用戶跳過

3. **步驟 3**: TDEE 基本信息
   - 必需字段：年齡、性別、身高、體重
   - 重定向邏輯：OAuth 用戶如果未完成，重定向到此

4. **步驟 4**: TDEE 完整設置
   - 必需字段：活動水平、目標、TDEE 計算
   - 重定向邏輯：如果步驟 3 完成但步驟 4 未完成，重定向到此

5. **步驟 5**: Newsletter（可選）
   - 可選步驟
   - 重定向邏輯：跳過（默認完成）

6. **步驟 6**: Sync Contacts（可選）
   - 可選步驟
   - 重定向邏輯：跳過（默認完成）

7. **步驟 7**: 角色選擇 ⭐ 新增（最後一步）
   - 必需步驟
   - 選項：USER, COACH, BOTH, ADMIN
   - 重定向邏輯：如果步驟 1-6 完成但角色未選擇，重定向到此

### 註冊狀態判斷邏輯

```typescript
if (!hasTDEEBasicInfo) {
  // 步驟 3 未完成
  nextStep = 3;
} else if (!hasTDEEComplete) {
  // 步驟 4 未完成
  nextStep = 4;
} else if (!hasRole) {
  // 步驟 7 未完成（角色選擇）
  nextStep = 7;
} else {
  // 所有步驟完成
  registrationStatus = 'complete';
}
```

## API 響應格式

### `/api/auth/registration-status` 響應

```json
{
  "success": true,
  "data": {
    "registrationStatus": "incomplete" | "partial" | "complete",
    "nextStep": 3 | 4 | 7 | null,
    "completedSteps": {
      "step1": true,
      "step2": true,
      "step3": false,
      "step4": false,
      "step5": true,
      "step6": true,
      "step7": false
    },
    "details": {
      "hasRole": false,
      "hasTDEEBasicInfo": false,
      "hasTDEEComplete": false
    }
  }
}
```

## 重定向邏輯

### Google OAuth 登入後重定向

1. **註冊狀態 = 'complete'**
   - 重定向到 `/dashboard`

2. **註冊狀態 = 'partial' && nextStep = 3**
   - 重定向到 `/register?step=3`（TDEE 基本信息）

3. **註冊狀態 = 'partial' && nextStep = 4**
   - 重定向到 `/register?step=4`（TDEE 完整設置）

4. **註冊狀態 = 'partial' && nextStep = 7**
   - 重定向到 `/register?step=7`（角色選擇）

5. **註冊狀態 = 'incomplete'**
   - 重定向到 `/register?step=1`（開始註冊流程）

6. **API 錯誤**
   - 重定向到 `/register?step=3`（假設需要 TDEE 設置）

## 待完成的工作

### 需要更新 RegisterFlow 組件

1. **更新 RegisterState 類型定義**
   - 將 `currentStep` 從 `1 | 2 | 3 | 4 | 5 | 6` 改為 `1 | 2 | 3 | 4 | 5 | 6 | 7`
   - 添加 `step7` 字段

2. **創建 Step7RoleSelection 組件**
   - 基於現有的 `RoleSelection` 組件
   - 適配到註冊流程中（使用 `onNext` 回調）

3. **更新 RegisterFlow 組件**
   - 添加步驟 7 的渲染邏輯
   - 更新 `handleNext` 和 `handleComplete` 邏輯
   - 更新 `totalSteps` 為 7

4. **更新 App.tsx**
   - 更新路由保護邏輯，適配新的註冊流程

## 測試建議

1. **OAuth 新用戶註冊**
   - 使用 Google OAuth 註冊新帳號
   - 應自動跳轉到 `/register?step=3`（TDEE 設置開始）

2. **部分完成用戶**
   - 完成步驟 3，但未完成步驟 4
   - 登入後應跳轉到 `/register?step=4`

3. **完成步驟 1-6 的用戶**
   - 完成 TDEE 設置，但未選擇角色
   - 登入後應跳轉到 `/register?step=7`（角色選擇）

4. **完成所有步驟的用戶**
   - 登入後應直接進入 Dashboard

## 文件修改清單

### 已修改
- ✅ `server/routes/auth.ts` - 修復 registration-status API
- ✅ `client/src/components/GoogleLoginButton.tsx` - 修復錯誤處理
- ✅ `server/routes/auth.ts` - 更新 OAuth 回調邏輯

### 待修改
- ⏳ `client/src/pages/auth/RegisterFlow/RegisterFlow.tsx` - 添加步驟 7
- ⏳ 創建 `client/src/pages/auth/RegisterFlow/Step7RoleSelection.tsx` - 新組件
- ⏳ `client/src/App.tsx` - 更新路由邏輯
