# React Query + Axios 統一方案實施總結

## ✅ 已完成的核心遷移

### 1. 基礎架構統一 ✅

**`client/src/lib/queryClient.ts`**
- ✅ 移除所有 `fetch` 調用
- ✅ 使用 `apiClient` (Axios) 作為底層 HTTP 客戶端
- ✅ 創建 `createQueryFn<T>()` 統一 Query Function
- ✅ 更新 `apiRequest()` 使用 Axios，支持所有 HTTP 方法

**優勢：**
- 所有 API 調用自動獲得 token 刷新、錯誤處理、重試邏輯
- 統一的錯誤處理和日誌記錄
- 更好的 TypeScript 類型支持

### 2. Hooks 遷移 ✅

**`client/src/hooks/use-meals.ts`**
- ✅ `useMeals()` - 使用 `createQueryFn<Meal[]>()`
- ✅ `useTodaysMeals()` - 使用 `createQueryFn<Meal[]>()`
- ✅ `useDeleteMeal()` - 使用 `apiRequest("DELETE", ...)`
- ✅ `useUpdateMeal()` - 使用 `apiRequest("PATCH", ...)`

**`client/src/hooks/use-tdee.ts`**
- ✅ `useTDEEProfile()` - 使用 `createQueryFn<TDEEProfile>()`
- ✅ `useCalculateTDEE()` - 使用 `apiRequest("POST", ...)`
- ✅ `useTodayProgress()` - 使用 `createQueryFn<TodayProgress>()`

### 3. 組件遷移 ✅

**`client/src/components/meal-form.tsx`**
- ✅ Nutrition search 使用 `apiClient.get()`
- ✅ Meal creation 使用 `apiRequest("POST", ...)`

**`client/src/components/workout-form.tsx`**
- ✅ Workout creation 使用 `apiRequest("POST", ...)`

**`client/src/components/tdee-calculator.tsx`**
- ✅ TDEE calculation 使用 `apiRequest("POST", ...)`

## 📊 遷移前後對比

### 遷移前（混亂狀態）
```typescript
// ❌ 多種方式混用
const response = await fetch("/api/meals", {
  headers: getHeaders(),
  credentials: "include",
});
const data = await response.json();

// ❌ 手動處理錯誤
if (!response.ok) {
  throw new Error("Failed");
}

// ❌ 沒有統一的 token 刷新
// ❌ 沒有統一的錯誤處理
// ❌ 代碼重複
```

### 遷移後（統一方案）
```typescript
// ✅ 統一使用 React Query + Axios
useQuery({
  queryKey: ["/api/meals"],
  queryFn: createQueryFn<Meal[]>(),
});

// ✅ 自動處理：
// - Token 刷新（通過 apiClient interceptor）
// - 錯誤處理（統一在 interceptor）
// - 重試邏輯（可配置）
// - Loading/Error 狀態（React Query）
// - 緩存管理（React Query）
```

## 🎯 核心優勢

### 1. 統一性
- ✅ 所有 API 調用都通過 `apiClient`
- ✅ 統一的錯誤處理
- ✅ 統一的 token 管理
- ✅ 統一的日誌記錄

### 2. 自動化
- ✅ 自動 token 刷新（401 時）
- ✅ 自動重試（5xx 錯誤）
- ✅ 自動緩存（React Query）
- ✅ 自動 loading/error 狀態

### 3. 開發體驗
- ✅ 更少的代碼
- ✅ 更好的類型安全
- ✅ 更容易維護
- ✅ 更容易測試

## 📋 待遷移項目

### 高優先級
1. **`dashboard.tsx`** - 多處直接 fetch 調用
   - `loadPersonalBests()` - 應使用 hook
   - `handleSubmitWorkout()` - 應使用 mutation
   - `handleDeleteWorkout()` - 應使用 mutation

2. **創建 `use-workouts.ts` hook**
   - `useWorkouts()` - 獲取所有 workouts
   - `useWorkoutStats()` - 獲取統計數據
   - `useDeleteWorkout()` - 刪除 workout
   - `useCreateWorkout()` - 創建 workout

### 中優先級
3. **`todays-meals.tsx`** - 直接 fetch 調用
4. **Coach 相關組件** - `WorkoutPlanEditor.tsx`, `ClientList.tsx`
5. **Dashboard 頁面** - `CoachDashboard.tsx`, `ClientDashboard.tsx`

## 🚀 下一步行動

### 立即可以做的
1. 創建 `use-workouts.ts` hook
2. 遷移 `dashboard.tsx` 使用新 hooks
3. 移除所有直接 `fetch` 調用

### 長期優化
1. 添加樂觀更新（Optimistic Updates）
2. 優化緩存策略
3. 添加請求去重（Deduplication）
4. 添加無限滾動支持（如果需要）

## 📝 使用指南

### 創建新的 Query Hook
```typescript
export function useWorkouts() {
  return useQuery<Workout[]>({
    queryKey: ["/api/workouts"],
    queryFn: createQueryFn<Workout[]>(),
  });
}
```

### 創建新的 Mutation Hook
```typescript
export function useCreateWorkout() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertWorkout) => {
      return await apiRequest("POST", "/api/workouts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
    },
  });
}
```

### 在組件中使用
```typescript
function MyComponent() {
  const { data, isLoading, error } = useWorkouts();
  const createWorkout = useCreateWorkout();
  
  // React Query 自動處理 loading 和 error
  if (isLoading) return <Loading />;
  if (error) return <Error />;
  
  return <div>{/* 使用 data */}</div>;
}
```

## ✨ 總結

✅ **已完成核心架構統一**
✅ **已遷移主要 hooks 和組件**
✅ **代碼更簡潔、更易維護**
🔄 **待遷移剩餘組件**

這個統一方案將大大提升 FitBuddy 的代碼質量和開發效率！

