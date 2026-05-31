# FitBuddy HTTP 客戶端方案分析

## 📊 當前狀態

### 已安裝的庫
- ✅ **Axios** (`^1.13.2`) - 已安裝
- ✅ **React Query** (`@tanstack/react-query ^5.60.5`) - 已安裝
- ✅ **原生 Fetch** - 內建，無需安裝

### 當前使用情況
1. **Axios** (`api-client.ts`)
   - 用於認證相關 API（login, register, refresh token）
   - 有完整的 interceptor 機制
   - Token 自動刷新邏輯
   - 重試機制
   - 離線管理

2. **Fetch** (`queryClient.ts` + 多處直接調用)
   - React Query 的 `apiRequest` 和 `getQueryFn` 使用 fetch
   - 多處直接使用 `fetch()`（dashboard, meals, workouts 等）
   - 需要手動添加 Authorization header

3. **React Query**
   - 部分使用（use-meals.ts, use-tdee.ts）
   - 但很多地方仍直接使用 fetch

## 🔍 三種方案對比

### 方案 1: 全局 Fetch
```typescript
// 優點
✅ 零依賴，內建支持
✅ 輕量級，包體積小
✅ 現代瀏覽器原生支持
✅ 符合 Web 標準

// 缺點
❌ 需要手動處理很多邏輯（interceptors, retry, timeout）
❌ 錯誤處理較繁瑣
❌ 沒有自動的請求/響應轉換
❌ 需要手動管理 loading/error 狀態
❌ 沒有內建的請求取消機制
```

### 方案 2: Axios
```typescript
// 優點
✅ 功能完整（interceptors, timeout, cancel）
✅ 自動 JSON 轉換
✅ 更好的錯誤處理
✅ 請求/響應攔截器
✅ 內建重試機制（可配置）
✅ 更好的 TypeScript 支持

// 缺點
❌ 額外的依賴（~13KB gzipped）
❌ 需要配置才能與 React Query 配合
❌ 某些功能（如 token refresh）需要手動實現
```

### 方案 3: React Query + Fetch/Axios
```typescript
// 優點
✅ 自動緩存管理
✅ 自動重試和錯誤處理
✅ 自動 loading/error 狀態
✅ 自動 refetch（focus, reconnect）
✅ 樂觀更新（Optimistic Updates）
✅ 請求去重（Deduplication）
✅ 無限滾動支持
✅ 與 React 完美集成

// 缺點
❌ 學習曲線
❌ 需要理解 Query Keys
❌ 對於簡單的一次性請求可能過度設計
```

## 💡 針對 FitBuddy 的建議

### 🎯 **推薦方案：React Query + Axios（統一）**

#### 理由：

1. **項目規模**
   - FitBuddy 是 MVP，但功能複雜（認證、教練-客戶、營養追蹤、訓練記錄）
   - 需要管理多個 API 端點
   - 需要緩存和狀態管理

2. **當前問題**
   - ❌ 混用 Fetch 和 Axios，代碼不一致
   - ❌ 多處直接使用 fetch，沒有統一管理
   - ❌ Token 刷新邏輯只在 Axios 中，Fetch 調用會失敗
   - ❌ 沒有統一的錯誤處理
   - ❌ 沒有統一的 loading 狀態管理

3. **FitBuddy 的需求**
   - ✅ 需要認證（JWT + Refresh Token）
   - ✅ 需要離線支持（已有 offline-manager）
   - ✅ 需要日誌追蹤（已有 logger）
   - ✅ 需要緩存（meals, workouts, TDEE 等）
   - ✅ 需要實時更新（添加 meal 後刷新列表）
   - ✅ 需要樂觀更新（提升 UX）

### 📋 實施建議

#### 階段 1: 統一使用 React Query + Axios
```typescript
// 1. 保留 api-client.ts 的 Axios 實例（用於認證）
// 2. 創建統一的 React Query hooks
// 3. 逐步遷移所有 fetch 調用到 React Query hooks

// 示例：use-meals.ts（已部分實現）
export function useMeals() {
  return useQuery({
    queryKey: ['meals'],
    queryFn: async () => {
      const response = await apiClient.get('/api/meals');
      return response.data;
    },
  });
}
```

#### 階段 2: 統一錯誤處理
```typescript
// 在 api-client.ts 中統一處理
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 統一錯誤處理
    // Token 刷新
    // 重試邏輯
    // 日誌記錄
  }
);
```

#### 階段 3: 移除直接 fetch 調用
```typescript
// ❌ 移除所有直接 fetch 調用
// ✅ 統一使用 React Query hooks
```

## 🎨 推薦架構

```
client/src/
├── lib/
│   ├── api-client.ts          # Axios 實例（認證、interceptors）
│   └── queryClient.ts         # React Query 配置
├── hooks/
│   ├── use-meals.ts          # Meals API hooks
│   ├── use-workouts.ts       # Workouts API hooks
│   ├── use-tdee.ts           # TDEE API hooks
│   └── use-auth.ts           # Auth API hooks（使用 apiClient）
└── components/
    └── ...                    # 使用 hooks，不直接調用 API
```

## 📊 對比表

| 特性 | Fetch | Axios | React Query + Axios |
|------|-------|-------|---------------------|
| **包體積** | 0 KB | ~13 KB | ~13 KB + ~10 KB |
| **學習曲線** | 低 | 中 | 中-高 |
| **功能完整性** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **緩存管理** | ❌ | ❌ | ✅ |
| **自動重試** | ❌ | ✅ | ✅ |
| **Loading 狀態** | 手動 | 手動 | 自動 |
| **錯誤處理** | 手動 | 手動 | 自動 |
| **TypeScript** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **適合 FitBuddy** | ❌ | ⚠️ | ✅ |

## 🚀 遷移計劃

### 步驟 1: 創建統一的 API Hooks
```typescript
// hooks/use-api.ts
export function useApiQuery<T>(key: string[], fn: () => Promise<T>) {
  return useQuery({
    queryKey: key,
    queryFn: fn,
    staleTime: 5 * 60 * 1000, // 5 分鐘
  });
}
```

### 步驟 2: 遷移現有 fetch 調用
- [ ] Dashboard 的 fetch → useWorkouts hook
- [ ] MealForm 的 fetch → useMeals hook
- [ ] TDEE Calculator 的 fetch → useTDEE hook

### 步驟 3: 統一錯誤處理
- [ ] 在 api-client.ts 中添加全局錯誤處理
- [ ] 在 React Query 中添加全局錯誤處理

### 步驟 4: 測試和優化
- [ ] 測試所有 API 調用
- [ ] 優化緩存策略
- [ ] 添加樂觀更新

## ⚠️ 注意事項

1. **不要完全移除 Axios**
   - 認證相關的 API（login, refresh token）應該繼續使用 Axios
   - 因為需要 interceptor 來處理 token 刷新

2. **React Query 不是萬能的**
   - 對於簡單的一次性請求（如登出），可以直接使用 apiClient
   - 不需要緩存的請求，可以使用 `useMutation`

3. **保持一致性**
   - 所有數據獲取使用 React Query
   - 所有數據修改使用 React Query mutations
   - 認證相關使用 Axios（通過 apiClient）

## 🎯 最終建議

**對於 FitBuddy MVP：使用 React Query + Axios（統一）**

- ✅ 解決當前的混亂狀態
- ✅ 提供更好的開發體驗
- ✅ 提升用戶體驗（緩存、樂觀更新）
- ✅ 更容易維護和擴展
- ✅ 符合現代 React 最佳實踐

**不推薦純 Fetch**，因為：
- ❌ 需要手動實現太多功能
- ❌ 代碼重複度高
- ❌ 難以維護

**不推薦純 Axios**，因為：
- ❌ 沒有緩存管理
- ❌ 需要手動管理 loading/error 狀態
- ❌ 不符合 React 的聲明式編程模式

