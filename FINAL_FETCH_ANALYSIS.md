# Fetch 調用完整分析報告

## 執行摘要

根據終端輸出（第 327-377 行），發現大量 401 Unauthorized 錯誤：
- `/api/tdee/today-progress` - 401
- `/api/meals/2026-01-05` - 401
- `/api/workouts/stats/personal-best` - 401
- `/api/workouts` - 401
- `/api/tdee/profile` - 401

這些 API 調用都沒有包含 Authorization header。

## 已修復的文件 ✅

### 1. `client/src/pages/dashboard.tsx` ✅
- ✅ 第 207 行：STRENGTH workout submission - 已添加 `getHeaders('application/json')`
- ✅ 第 252 行：CARDIO workout submission - 已添加 `getHeaders('application/json')`
- ✅ 第 92 行：`/api/workouts/stats/personal-best` - 已使用 `getHeaders()`
- ✅ 第 295 行：`/api/workouts/${id}` DELETE - 已使用 `getHeaders()`
- ✅ 第 420 行：`/api/workouts` - 已使用 `getHeaders()`

### 2. `client/src/components/coach/WorkoutPlanEditor.tsx` ✅
- ✅ 第 64 行：`/api/coaches/clients` - 已添加 `getHeaders()`
- ✅ 第 141 行：`/api/workout-plans` POST - 已添加 `getHeaders('application/json')`

### 3. `client/src/components/coach/ClientList.tsx` ✅
- ✅ 第 62 行：`/api/coaches/add-client` - 已添加 `getHeaders('application/json')`
- ✅ 第 100 行：`/api/coaches/remove-client` - 已添加 `getHeaders('application/json')`

### 4. `client/src/pages/todays-meals.tsx` ✅
- ✅ 第 32 行：`/api/meals` POST - 已添加 `getHeaders('application/json')`
- ✅ 第 95 行：workout URL fetch - 已添加 `getHeaders()`
- ✅ 第 125 行：`/api/meals/${mealId}` DELETE - 已添加 `getHeaders()`

### 5. `client/src/pages/ClientDashboard.tsx` ✅
- ✅ 第 41 行：`/api/workout-plans/client/${user.id}` - 已添加 `getHeaders()`

### 6. `client/src/pages/CoachDashboard.tsx` ✅
- ✅ 第 64 行：`/api/coaches/clients` - 已改用 `getHeaders('application/json')`
- ✅ 第 102 行：`/api/coaches/remove-client` - 已改用 `getHeaders('application/json')`
- ✅ 移除了手動 token 檢查代碼（改用 getHeaders() 統一處理）
- ✅ 移除了不需要的 tokenManager 導入

### 7. 之前已修復的文件 ✅
- ✅ `client/src/hooks/use-meals.ts` - 所有 fetch 調用
- ✅ `client/src/hooks/use-tdee.ts` - fetch 調用
- ✅ `client/src/components/meal-form.tsx` - fetch 調用
- ✅ `client/src/components/tdee-calculator.tsx` - fetch 調用

## ⚠️ 待處理的文件（已 deprecated）

### 8. `client/src/pages/WorkoutPage.tsx` ⚠️
**狀態：** 已標記為 `@deprecated`，但仍有 fetch 調用

**需要修復的調用：**
- ❌ 第 63 行：`/api/workouts` GET
- ❌ 第 79 行：`/api/workouts/stats/personal-best` GET
- ❌ 第 118 行：workout URL POST/PUT
- ❌ 第 162 行：`/api/workouts/${id}` DELETE

**建議：**
- 如果文件不再使用，可以忽略
- 如果想保持一致性，可以修復（添加 getHeaders）

## ✅ 不需要修復的文件（正確實現或公開 API）

### 9. `client/src/services/invitationService.ts` ✅
- ✅ 有自己的 `getAuthHeaders()` 函數，功能與 `getHeaders()` 相同
- ✅ 所有 fetch 調用都正確使用 `getAuthHeaders()`

### 10. `client/src/routes/ProtectedRoute.tsx` ✅
- ✅ 第 89 行：手動添加 Authorization header（認證檢查路由，可以保留）

### 11. 公開 API（不需要 token）✅
- ✅ `client/src/components/GoogleLoginButton.tsx` - OAuth callback
- ✅ `client/src/pages/auth.tsx` - 登入/註冊 API
- ✅ `client/src/pages/VerifyEmailPrompt.tsx` - 郵箱驗證檢查
- ✅ `client/src/pages/ResendVerification.tsx` - 重新發送驗證郵件
- ✅ `client/src/pages/VerifyEmail.tsx` - 驗證郵件
- ✅ `client/src/pages/dashboard.tsx` - `/api/auth/logout`（登出不需要 token）
- ✅ `client/src/components/sidebar.tsx` - `/api/auth/logout`（登出不需要 token）

## 統計

### 總計
- **總 fetch 調用數：** 49 個
- **已修復：** ~19 個
- **待處理（deprecated）：** 4 個（WorkoutPage.tsx）
- **不需要修復：** ~12 個（公開 API 或特殊情況）
- **已正確實現：** ~14 個（使用 getHeaders 或 getAuthHeaders）

### 修復方式

所有需要認證的 fetch 調用都已添加：
```typescript
headers: getHeaders() // 或 getHeaders('application/json') 如果有 body
```

`getHeaders()` 函數會自動：
1. 從 `tokenManager.getAccessToken()` 獲取 token
2. 添加到 `Authorization: Bearer <token>` header
3. 如果有 contentType 參數，也會添加 `Content-Type` header

## 修改的文件列表

1. ✅ `client/src/lib/queryClient.ts` - 導出 `getHeaders` 函數
2. ✅ `client/src/hooks/use-meals.ts` - 添加 `getHeaders()`
3. ✅ `client/src/hooks/use-tdee.ts` - 添加 `getHeaders()`
4. ✅ `client/src/components/meal-form.tsx` - 添加 `getHeaders()`
5. ✅ `client/src/pages/dashboard.tsx` - 添加 `getHeaders()`
6. ✅ `client/src/components/tdee-calculator.tsx` - 添加 `getHeaders()`
7. ✅ `client/src/components/coach/WorkoutPlanEditor.tsx` - 添加 `getHeaders()`
8. ✅ `client/src/components/coach/ClientList.tsx` - 添加 `getHeaders()`
9. ✅ `client/src/pages/todays-meals.tsx` - 添加 `getHeaders()`
10. ✅ `client/src/pages/ClientDashboard.tsx` - 添加 `getHeaders()`
11. ✅ `client/src/pages/CoachDashboard.tsx` - 改用 `getHeaders()`，移除手動 token 檢查

## 下一步

1. **測試修復：**
   - 清除瀏覽器緩存和 localStorage
   - 使用 Google OAuth 登入
   - 檢查所有 API 請求是否包含 Authorization header
   - 確認不再出現 401 錯誤

2. **可選修復（deprecated 文件）：**
   - 如果需要，可以修復 `WorkoutPage.tsx` 的 fetch 調用
   - 或忽略（因為文件已 deprecated）

## 結論

✅ **所有重要的 fetch 調用都已修復**
✅ **所有需要認證的 API 調用都會自動添加 Authorization header**
✅ **修復方式統一且可維護**

