# 📦 導出函數總結

## ✅ `client/src/lib/queryClient.ts` 導出的函數

### 1. `createQueryFn<T>()` ✅
- **用途：** 創建 React Query 的 Query Function
- **替代：** 舊的 `getQueryFn()`
- **使用：** 
  ```typescript
  useQuery({
    queryKey: ['/api/meals'],
    queryFn: createQueryFn<Meal[]>(),
  });
  ```

### 2. `apiRequest<T>()` ✅
- **用途：** 統一的 API Request 函數（支持所有 HTTP 方法）
- **使用：**
  ```typescript
  await apiRequest("POST", "/api/meals", data);
  await apiRequest("DELETE", "/api/meals/123");
  ```

### 3. `queryClient` ✅
- **用途：** React Query Client 實例
- **使用：**
  ```typescript
  queryClient.invalidateQueries({ queryKey: ['/api/meals'] });
  ```

## ✅ `client/src/lib/api-client.ts` 導出的函數

### 1. `apiClient` ✅
- **用途：** Axios 實例（已配置 interceptors）
- **使用：**
  ```typescript
  await apiClient.get('/api/meals');
  await apiClient.post('/api/meals', data);
  ```

### 2. `tokenManager` ✅
- **用途：** Token 管理工具
- **方法：**
  - `getAccessToken()` - 獲取 access token
  - `setAccessToken(token)` - 設置 access token
  - `getRefreshToken()` - 獲取 refresh token
  - `setRefreshToken(token)` - 設置 refresh token
  - `clear()` - 清除所有 tokens
  - `isAccessTokenExpired()` - 檢查 token 是否過期

### 3. `api` ✅
- **用途：** API 方法對象（認證相關）
- **方法：**
  - `api.auth.login(email, password)`
  - `api.auth.register(email, password, firstName?, lastName?)`
  - `api.auth.selectRole(role)`
  - `api.auth.me()`
  - `api.auth.refresh(refreshToken)`
  - `api.auth.logout()`
  - `api.meals.*` - Meals API
  - `api.workouts.*` - Workouts API

## ❌ 不再導出的函數

以下函數已移除，不應再使用：
- ❌ `getHeaders()` - 已移除（改用 `apiClient`，自動處理 headers）
- ❌ `getQueryFn()` - 已移除（改用 `createQueryFn()`）

## 📝 遷移對照表

| 舊函數 | 新函數 | 說明 |
|--------|--------|------|
| `getHeaders()` | `apiClient` | 直接使用 `apiClient`，自動處理 headers |
| `getQueryFn()` | `createQueryFn<T>()` | 需要指定類型參數 |
| `fetch()` + `getHeaders()` | `apiClient.get/post/put/patch/delete()` | 使用 Axios 方法 |
| `fetch()` + `getHeaders()` | `apiRequest()` | 使用統一的 API Request 函數 |

## ✅ 所有必需的函數都已導出

根據用戶要求，以下函數都已正確導出：
- ✅ `apiRequest` - 在 `queryClient.ts` 中導出
- ✅ `createQueryFn` - 在 `queryClient.ts` 中導出
- ✅ `apiClient` - 在 `api-client.ts` 中導出
- ✅ `queryClient` - 在 `queryClient.ts` 中導出
- ✅ `tokenManager` - 在 `api-client.ts` 中導出（包含 `getTokens`, `setTokens`, `clearTokens`）

**注意：** 以下函數不在 `queryClient.ts` 或 `api-client.ts` 中，它們在 `auth.store.ts` 中：
- `isLoggedIn` - 使用 `useAuthStore().isAuthenticated`
- `getCurrentUser` - 使用 `useAuthStore().user`
- `setCurrentUser` - 使用 `useAuthStore().setUser`

這些是 Zustand store 的方法，不是 API 客戶端的功能。

