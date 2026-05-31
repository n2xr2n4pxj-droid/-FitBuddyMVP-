# 遺漏 Authorization Header 的 Fetch 調用分析

## 從日誌看到的 401 錯誤

以下 API 調用返回 401 Unauthorized：
- `/api/tdee/today-progress` - 401
- `/api/meals/2026-01-05` - 401
- `/api/workouts/stats/personal-best` - 401
- `/api/workouts` - 401
- `/api/tdee/profile` - 401
- `/api/summary/weekly` - 404 (可能是路由問題)
- `/api/summary/daily/2026-01-05` - 404 (可能是路由問題)

## 已經修復的文件（✅ 有 getHeaders）

1. ✅ `client/src/hooks/use-meals.ts` - 所有 fetch 調用都使用 getHeaders
2. ✅ `client/src/hooks/use-tdee.ts` - 所有 fetch 調用都使用 getHeaders
3. ✅ `client/src/components/meal-form.tsx` - 所有 fetch 調用都使用 getHeaders
4. ✅ `client/src/pages/dashboard.tsx` - 部分 fetch 調用使用 getHeaders

## 需要檢查的文件

以下文件中有 fetch 調用，需要檢查是否使用 getHeaders：

1. **`client/src/pages/dashboard.tsx`**
   - 第 207 行：POST /api/workouts (提交訓練)
   - 第 252 行：POST /api/workouts (提交 CARDIO 訓練)
   - 第 39 行：POST /api/auth/logout (登出，這個可能不需要 Authorization)

2. **`client/src/pages/todays-meals.tsx`**
   - 第 32 行：GET /api/meals
   - 第 95 行：POST/PUT /api/meals (創建/更新餐點)
   - 第 125 行：DELETE /api/meals/:id

3. **`client/src/pages/WorkoutPage.tsx`**
   - 第 63 行：GET /api/workouts
   - 第 79 行：GET /api/workouts/stats/personal-best
   - 第 118 行：POST /api/workouts
   - 第 162 行：DELETE /api/workouts/:id

4. **`client/src/components/coach/WorkoutPlanEditor.tsx`**
   - 第 64 行：GET /api/coaches/clients
   - 第 141 行：POST /api/workout-plans

5. **`client/src/components/coach/ClientList.tsx`**
   - 第 62 行：POST /api/coaches/add-client
   - 第 100 行：POST /api/coaches/remove-client

6. **`client/src/pages/ClientDashboard.tsx`**
   - 第 41 行：GET /api/workout-plans/client/:id

7. **`client/src/components/sidebar.tsx`**
   - 第 18 行：POST /api/auth/logout (登出，可能不需要 Authorization)

8. **`client/src/routes/ProtectedRoute.tsx`**
   - 第 89 行：GET /api/auth/me (這個應該能工作，因為是認證檢查)

9. **`client/src/services/invitationService.ts`**
   - 多個 fetch 調用（可能需要檢查）

## 不需要 Authorization 的 API

以下 API 調用不需要 Authorization header（因為是公開或認證相關）：
- `/api/auth/google/callback` - Google OAuth 回調
- `/api/auth/login` - 登入
- `/api/auth/register` - 註冊
- `/api/auth/logout` - 登出（可選）
- `/api/v1/auth/verify-email/:token` - 郵箱驗證
- `/api/v1/auth/resend-verification` - 重新發送驗證郵件
- `/api/v1/auth/check-email-verified` - 檢查郵箱驗證狀態

