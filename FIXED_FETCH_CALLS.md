# 已修復的 Fetch 調用總結

## ✅ 已修復的文件

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
- ✅ 第 95 行：workout URL - 已添加 `getHeaders()`
- ✅ 第 125 行：`/api/meals/${mealId}` DELETE - 已添加 `getHeaders()`

### 5. `client/src/pages/ClientDashboard.tsx` ✅
- ✅ 第 41 行：`/api/workout-plans/client/${user.id}` - 已添加 `getHeaders()`

### 6. `client/src/pages/CoachDashboard.tsx` ✅
- ✅ 第 64 行：`/api/coaches/clients` - 已改用 `getHeaders('application/json')`
- ✅ 第 102 行：`/api/coaches/remove-client` - 已改用 `getHeaders('application/json')`
- ✅ 移除了手動 token 檢查代碼（改用 getHeaders() 統一處理）

## ⚠️ 待處理的文件

### 7. `client/src/pages/WorkoutPage.tsx` ⚠️ (已標記為 @deprecated)
- ❌ 第 63 行：`/api/workouts` - **需要修復**（但文件已 deprecated）
- ❌ 第 79 行：`/api/workouts/stats/personal-best` - **需要修復**（但文件已 deprecated）
- ❌ 第 118 行：workout URL - **需要修復**（但文件已 deprecated）
- ❌ 第 162 行：`/api/workouts/${id}` DELETE - **需要修復**（但文件已 deprecated）

**建議：** 由於文件已標記為 deprecated，可以選擇：
1. 修復這些調用以保持一致性
2. 或忽略（因為文件已不再使用）

## ✅ 不需要修復的文件（正確實現）

### 8. `client/src/services/invitationService.ts` ✅
- ✅ 所有 fetch 調用都使用自己的 `getAuthHeaders()` 函數（正確實現）
- ✅ 功能與 `getHeaders()` 相同

### 9. `client/src/routes/ProtectedRoute.tsx` ✅
- ✅ 第 89 行：手動添加 Authorization header（可以保留，因為是認證檢查路由）

### 10. 公開 API（不需要 token）
- ✅ `client/src/components/GoogleLoginButton.tsx` - OAuth callback
- ✅ `client/src/pages/auth.tsx` - 登入/註冊
- ✅ `client/src/pages/VerifyEmailPrompt.tsx` - 郵箱驗證檢查
- ✅ `client/src/pages/ResendVerification.tsx` - 重新發送驗證郵件
- ✅ `client/src/pages/VerifyEmail.tsx` - 驗證郵件
- ✅ `client/src/pages/dashboard.tsx` - `/api/auth/logout`（登出不需要 token）
- ✅ `client/src/components/sidebar.tsx` - `/api/auth/logout`（登出不需要 token）

## 統計

- **已修復：** ~15 個 fetch 調用
- **待處理：** 4 個（WorkoutPage.tsx，但已 deprecated）
- **不需要修復：** ~12 個（公開 API 或特殊情況）
- **總計：** 約 49 個 fetch 調用

## 修復方式

所有需要認證的 fetch 調用都已添加：
```typescript
headers: getHeaders() // 或 getHeaders('application/json') 如果有 body
```

`getHeaders()` 函數會自動：
1. 從 `tokenManager` 獲取 access token
2. 添加到 `Authorization: Bearer <token>` header
3. 如果有 contentType 參數，也會添加 Content-Type header

