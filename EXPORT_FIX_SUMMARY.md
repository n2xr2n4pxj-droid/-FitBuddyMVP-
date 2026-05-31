# getHeaders 導出錯誤修復總結

## 🐛 問題

錯誤信息：`The requested module '/src/lib/queryClient.ts' does not provide an export named 'getHeaders'`

**原因：** 在遷移到 React Query + Axios 統一方案時，`getHeaders` 函數已被移除，但仍有文件在導入和使用它。

## ✅ 已修復的文件

### 1. `client/src/pages/CoachDashboard.tsx` ✅
- ❌ 移除：`import { getHeaders } from '@/lib/queryClient';`
- ✅ 添加：`import { apiClient } from '@/lib/api-client';`
- ✅ 修復：`fetch('/api/coaches/clients')` → `apiClient.get('/api/coaches/clients')`
- ✅ 修復：`fetch('/api/coaches/remove-client')` → `apiClient.post('/api/coaches/remove-client')`

### 2. `client/src/pages/ClientDashboard.tsx` ✅
- ❌ 移除：`import { getHeaders } from '@/lib/queryClient';`
- ✅ 添加：`import { apiClient } from '@/lib/api-client';`
- ✅ 修復：`fetch('/api/workout-plans/client/${user.id}')` → `apiClient.get(...)`

### 3. `client/src/components/coach/ClientList.tsx` ✅
- ❌ 移除：`import { getHeaders } from '@/lib/queryClient';`
- ✅ 添加：`import { apiClient } from '@/lib/api-client';`
- ✅ 修復：`fetch('/api/coaches/add-client')` → `apiClient.post(...)`
- ✅ 修復：`fetch('/api/coaches/remove-client')` → `apiClient.post(...)`

### 4. `client/src/components/coach/WorkoutPlanEditor.tsx` ✅
- ❌ 移除：`import { getHeaders } from '@/lib/queryClient';`
- ✅ 添加：`import { apiClient } from '@/lib/api-client';`
- ✅ 修復：`fetch('/api/coaches/clients')` → `apiClient.get(...)`
- ✅ 修復：`fetch('/api/workout-plans')` → `apiClient.post(...)`

### 5. `client/src/pages/todays-meals.tsx` ✅
- ❌ 移除：`import { getQueryFn, getHeaders } from "@/lib/queryClient";`
- ✅ 添加：`import { createQueryFn, apiRequest } from "@/lib/queryClient";`
- ✅ 添加：`import { apiClient } from "@/lib/api-client";`
- ✅ 修復：`getQueryFn({ on401: "returnNull" })` → `createQueryFn<T>({ on401: "returnNull" })`
- ✅ 修復：所有 `fetch` 調用 → `apiClient` 或 `apiRequest`

## 📋 當前導出的函數

### `client/src/lib/queryClient.ts`
- ✅ `createQueryFn<T>()` - 創建 Query Function
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

## ✅ 遷移指南

### 舊代碼（使用 getHeaders）
```typescript
// ❌ 舊
import { getHeaders } from '@/lib/queryClient';

const response = await fetch('/api/endpoint', {
  headers: getHeaders('application/json'),
  credentials: 'include',
  body: JSON.stringify(data),
});
```

### 新代碼（使用 apiClient）
```typescript
// ✅ 新
import { apiClient } from '@/lib/api-client';

const response = await apiClient.post('/api/endpoint', data);
// 或
const response = await apiClient.get('/api/endpoint');
```

### 舊代碼（使用 getQueryFn）
```typescript
// ❌ 舊
import { getQueryFn } from '@/lib/queryClient';

useQuery({
  queryKey: ['/api/endpoint'],
  queryFn: getQueryFn({ on401: "returnNull" }),
});
```

### 新代碼（使用 createQueryFn）
```typescript
// ✅ 新
import { createQueryFn } from '@/lib/queryClient';

useQuery({
  queryKey: ['/api/endpoint'],
  queryFn: createQueryFn<DataType>({ on401: "returnNull" }),
});
```

## 🎯 修復完成

所有使用 `getHeaders` 和 `getQueryFn` 的文件都已修復並遷移到新的統一方案。

**現在應該可以正常運行！** ✅

