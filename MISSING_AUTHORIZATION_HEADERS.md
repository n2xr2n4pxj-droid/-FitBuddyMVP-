# 缺少 Authorization Header 的 Fetch 調用報告

根據終端輸出，以下是所有沒有使用 `getHeaders()` 的 fetch 調用：

## 需要修復的文件

### 1. `client/src/pages/dashboard.tsx` ⚠️ 部分需要修復
- ✅ 第 92 行：`/api/workouts/stats/personal-best` - 已使用 `getHeaders()`
- ✅ 第 295 行：`/api/workouts/${id}` DELETE - 已使用 `getHeaders()`
- ✅ 第 420 行：`/api/workouts` - 已使用 `getHeaders()`
- ❌ 第 207 行：STRENGTH workout submission - **缺少 getHeaders()**
- ❌ 第 252 行：CARDIO workout submission - **缺少 getHeaders()**
- ⚠️ 第 39 行：`/api/auth/logout` - 登出不需要 token（可選）

### 2. `client/src/components/coach/WorkoutPlanEditor.tsx` ❌
- ❌ 第 64 行：`/api/coaches/clients` - **缺少 getHeaders()**
- ❌ 第 141 行：`/api/workout-plans` - **缺少 getHeaders()**

### 3. `client/src/components/coach/ClientList.tsx` ❌
- ❌ 第 62 行：`/api/coaches/add-client` - **缺少 getHeaders()**
- ❌ 第 100 行：`/api/coaches/remove-client` - **缺少 getHeaders()**

### 4. `client/src/pages/todays-meals.tsx` ❌
- ❌ 第 32 行：`/api/meals` - **缺少 getHeaders()**
- ❌ 第 95 行：workout URL - **缺少 getHeaders()**
- ❌ 第 125 行：`/api/meals/${mealId}` DELETE - **缺少 getHeaders()**

### 5. `client/src/pages/CoachDashboard.tsx` ❌
- ❌ 第 64 行：`/api/coaches/clients` - **缺少 getHeaders()**
- ❌ 第 102 行：`/api/coaches/remove-client` - **缺少 getHeaders()**

### 6. `client/src/pages/WorkoutPage.tsx` ❌ (已標記為 @deprecated，但仍需檢查)
- ❌ 第 63 行：`/api/workouts` - **缺少 getHeaders()**
- ❌ 第 79 行：`/api/workouts/stats/personal-best` - **缺少 getHeaders()**
- ❌ 第 118 行：workout URL - **缺少 getHeaders()**
- ❌ 第 162 行：`/api/workouts/${id}` DELETE - **缺少 getHeaders()**

### 7. `client/src/pages/ClientDashboard.tsx` ❌
- ❌ 第 41 行：`/api/workout-plans/client/${user.id}` - **缺少 getHeaders()**

### 8. `client/src/components/sidebar.tsx` ⚠️
- ⚠️ 第 18 行：`/api/auth/logout` - 登出不需要 token（可選）

### 9. `client/src/routes/ProtectedRoute.tsx` ⚠️
- ⚠️ 第 89 行：`/api/auth/me` - **需要檢查**（認證檢查路由，可能需要 token）

### 10. `client/src/services/invitationService.ts` ❌
- ❌ 多個 fetch 調用都需要檢查

### 11. 不需要修復的文件（這些是公開 API 或特殊情況）
- ✅ `client/src/components/GoogleLoginButton.tsx` - OAuth callback，不需要 token
- ✅ `client/src/pages/auth.tsx` - 登入/註冊 API，不需要 token
- ✅ `client/src/pages/VerifyEmailPrompt.tsx` - 郵箱驗證檢查，可能需要 token（需要確認）
- ✅ `client/src/pages/ResendVerification.tsx` - 重新發送驗證郵件，不需要 token
- ✅ `client/src/pages/VerifyEmail.tsx` - 驗證郵件，不需要 token
- ✅ `client/src/lib/logger.ts` - 日誌服務，可能需要特殊處理
- ✅ `client/src/lib/queryClient.ts` - 已正確使用 getHeaders()

## 總結

**需要立即修復的 fetch 調用：約 15+ 個**

主要集中在：
1. Dashboard 的 workout 提交（STRENGTH 和 CARDIO）
2. Coach 相關的 API 調用
3. WorkoutPage（已 deprecated，但仍在代碼中）
4. ClientDashboard
5. todays-meals 頁面
6. invitationService

