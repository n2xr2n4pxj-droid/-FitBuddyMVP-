# React Query + Axios 統一方案遷移進度

## ✅ 已完成

### 1. 基礎架構 ✅
- [x] 更新 `queryClient.ts` 使用 `apiClient` (Axios)
- [x] 創建 `createQueryFn` 統一 Query Function
- [x] 更新 `apiRequest` 使用 Axios

### 2. Hooks 遷移 ✅
- [x] `use-meals.ts` - 所有方法已遷移到 Axios
- [x] `use-tdee.ts` - 所有方法已遷移到 Axios

### 3. 組件遷移 ✅
- [x] `meal-form.tsx` - 使用 `apiClient` 和 `apiRequest`
- [x] `workout-form.tsx` - 使用 `apiRequest`
- [x] `tdee-calculator.tsx` - 使用 `apiRequest`

## 🔄 待遷移

### 4. Dashboard 和其他頁面
- [ ] `dashboard.tsx` - 多處直接 fetch 調用
- [ ] `todays-meals.tsx` - 直接 fetch 調用
- [ ] `CoachDashboard.tsx` - 直接 fetch 調用
- [ ] `ClientDashboard.tsx` - 直接 fetch 調用
- [ ] `WorkoutPage.tsx` - 直接 fetch 調用（已 deprecated）

### 5. Coach 相關組件
- [ ] `WorkoutPlanEditor.tsx` - 直接 fetch 調用
- [ ] `ClientList.tsx` - 直接 fetch 調用

### 6. 創建新的 Hooks
- [ ] `use-workouts.ts` - 創建統一的 workouts hook
- [ ] `use-nutrition.ts` - 創建統一的 nutrition hook

## 📋 遷移指南

### 遷移步驟

1. **替換 import**
   ```typescript
   // ❌ 舊
   import { getHeaders } from "@/lib/queryClient";
   
   // ✅ 新
   import { createQueryFn, apiRequest } from "@/lib/queryClient";
   import { apiClient } from "@/lib/api-client";
   ```

2. **遷移 Query**
   ```typescript
   // ❌ 舊
   useQuery({
     queryKey: ["/api/meals"],
     queryFn: async () => {
       const response = await fetch("/api/meals", {
         headers: getHeaders(),
         credentials: "include",
       });
       return response.json();
     },
   });
   
   // ✅ 新
   useQuery({
     queryKey: ["/api/meals"],
     queryFn: createQueryFn<Meal[]>(),
   });
   ```

3. **遷移 Mutation**
   ```typescript
   // ❌ 舊
   mutationFn: async (data) => {
     const response = await fetch("/api/meals", {
       method: "POST",
       headers: getHeaders("application/json"),
       body: JSON.stringify(data),
       credentials: "include",
     });
     return response.json();
   }
   
   // ✅ 新
   mutationFn: async (data) => {
     return await apiRequest("POST", "/api/meals", data);
   }
   ```

## 🎯 優勢

### 統一後的好處
1. ✅ 所有 API 調用都通過 `apiClient`，自動處理：
   - Token 刷新
   - 錯誤處理
   - 重試邏輯
   - 請求日誌

2. ✅ React Query 提供：
   - 自動緩存
   - Loading/Error 狀態
   - 自動 refetch
   - Query invalidation

3. ✅ 代碼更簡潔：
   - 不需要手動添加 headers
   - 不需要手動處理錯誤
   - 不需要手動管理 loading 狀態

## 📝 注意事項

1. **認證相關 API** 繼續使用 `api.auth.*`（已在 `api-client.ts` 中定義）
2. **Query Keys** 保持一致性：`["/api/meals"]`, `["/api/workouts"]` 等
3. **錯誤處理** 統一在 `apiClient` interceptor 中處理
4. **Token 刷新** 自動處理，無需手動干預

