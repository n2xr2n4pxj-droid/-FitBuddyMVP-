# Fetch 調用分析報告

## 已正確使用 getHeaders() 的文件 ✅

1. ✅ `client/src/lib/queryClient.ts` - 已正確使用
2. ✅ `client/src/hooks/use-meals.ts` - 已修復
3. ✅ `client/src/hooks/use-tdee.ts` - 已修復
4. ✅ `client/src/components/meal-form.tsx` - 已修復
5. ✅ `client/src/components/tdee-calculator.tsx` - 已修復
6. ✅ `client/src/pages/dashboard.tsx` - 部分已修復（workout submission 剛修復）
7. ✅ `client/src/services/invitationService.ts` - 有自己的 getAuthHeaders() 函數（正確）

## 需要修復的文件 ❌

### 高優先級（導致 401 錯誤）

1. ❌ **`client/src/pages/dashboard.tsx`** - 第 207, 252 行（workout submission）✅ **已修復**
2. ❌ **`client/src/components/coach/WorkoutPlanEditor.tsx`** - 第 64, 141 行
3. ❌ **`client/src/components/coach/ClientList.tsx`** - 第 62, 100 行
4. ❌ **`client/src/pages/todays-meals.tsx`** - 第 32, 95, 125 行
5. ❌ **`client/src/pages/ClientDashboard.tsx`** - 第 41 行
6. ❌ **`client/src/pages/WorkoutPage.tsx`** - 第 63, 79, 118, 162 行（已 deprecated，但仍需修復）

### 中優先級（手動添加了 header，但應該統一使用 getHeaders()）

7. ⚠️ **`client/src/pages/CoachDashboard.tsx`** - 第 64, 102 行（已手動添加 Authorization，但應改用 getHeaders()）
8. ⚠️ **`client/src/routes/ProtectedRoute.tsx`** - 第 89 行（已手動添加 Authorization，可以保留）

### 低優先級（不需要 token）

9. ✅ **`client/src/components/GoogleLoginButton.tsx`** - OAuth callback，不需要 token
10. ✅ **`client/src/pages/auth.tsx`** - 登入/註冊 API，不需要 token
11. ✅ **`client/src/pages/VerifyEmailPrompt.tsx`** - 郵箱驗證檢查，不需要 token
12. ✅ **`client/src/pages/ResendVerification.tsx`** - 重新發送驗證郵件，不需要 token
13. ✅ **`client/src/pages/VerifyEmail.tsx`** - 驗證郵件，不需要 token
14. ✅ **`client/src/pages/dashboard.tsx`** - 第 39 行 `/api/auth/logout` - 登出不需要 token（可選）
15. ✅ **`client/src/components/sidebar.tsx`** - 第 18 行 `/api/auth/logout` - 登出不需要 token（可選）
16. ✅ **`client/src/lib/logger.ts`** - 日誌服務，可能需要特殊處理

## 統計

- **總 fetch 調用數：** 49 個
- **已正確使用 getHeaders()：** ~20 個
- **需要修復：** ~15 個（高優先級）
- **已手動添加但應統一：** 2 個（中優先級）
- **不需要修復：** ~12 個（公開 API 或特殊情況）

