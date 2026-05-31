# ✅ getHeaders 導出錯誤修復完成

## 🐛 問題

錯誤：`The requested module '/src/lib/queryClient.ts' does not provide an export named 'getHeaders'`

**原因：** 在遷移到 React Query + Axios 統一方案時，`getHeaders` 和 `getQueryFn` 函數已被移除，但仍有文件在導入和使用它們。

## ✅ 已修復的文件

### 1. `client/src/pages/CoachDashboard.tsx` ✅
- ✅ 移除 `getHeaders` import
- ✅ 添加 `apiClient` import
- ✅ 遷移所有 fetch 調用到 `apiClient`

### 2. `client/src/pages/ClientDashboard.tsx` ✅
- ✅ 移除 `getHeaders` import
- ✅ 添加 `apiClient` import
- ✅ 遷移 fetch 調用到 `apiClient.get()`

### 3. `client/src/components/coach/ClientList.tsx` ✅
- ✅ 移除 `getHeaders` import
- ✅ 添加 `apiClient` import
- ✅ 遷移所有 fetch 調用到 `apiClient`

### 4. `client/src/components/coach/WorkoutPlanEditor.tsx` ✅
- ✅ 移除 `getHeaders` import
- ✅ 添加 `apiClient` import
- ✅ 遷移所有 fetch 調用到 `apiClient`

### 5. `client/src/pages/todays-meals.tsx` ✅
- ✅ 移除 `getHeaders` 和 `getQueryFn` import
- ✅ 添加 `createQueryFn`, `apiRequest`, `apiClient` import
- ✅ 遷移所有 fetch 調用到 `apiClient` 或 `apiRequest`
- ✅ 遷移 `getQueryFn` 到 `createQueryFn`

## 📋 當前導出的函數

### `client/src/lib/queryClient.ts`
- ✅ `createQueryFn<T>()` - 創建 Query Function（替代 `getQueryFn`）
- ✅ `apiRequest()` - 統一的 API Request 函數
- ✅ `queryClient` - React Query Client 實例

### `client/src/lib/api-client.ts`
- ✅ `apiClient` - Axios 實例（已導出）
- ✅ `tokenManager` - Token 管理工具
  - `getAccessToken()`
  - `setAccessToken()`
  - `getRefreshToken()`
  - `setRefreshToken()`
  - `clear()`
  - `isAccessTokenExpired()`
- ✅ `api` - API 方法對象（認證相關）

## ❌ 不再導出的函數

以下函數已移除，不應再使用：
- ❌ `getHeaders()` - 已移除（改用 `apiClient`，自動處理 headers）
- ❌ `getQueryFn()` - 已移除（改用 `createQueryFn()`）

## ✅ 修復完成

所有使用 `getHeaders` 和 `getQueryFn` 的文件都已修復並遷移到新的統一方案。

**現在應該可以正常運行！** ✅

請重新啟動開發服務器並測試。

