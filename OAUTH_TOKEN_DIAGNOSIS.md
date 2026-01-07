# Google OAuth Token 儲存問題診斷報告

## 問題總結

✅ **Backend 正確產生 JWT tokens**
❌ **Frontend 收到 response 後沒有正確使用 token，導致後續 API 都返回 401**

## 診斷結果

### 1. ✅ 路由檢查

**不存在 `/auth/callback` 路由**
- `client/src/App.tsx` 中沒有 `/auth/callback` 或 `/auth/google-callback` 路由
- **原因：** 使用 `@react-oauth/google` 的 `useGoogleLogin` hook，不需要專門的 callback 路由
- OAuth 流程完全在客戶端處理（使用 `auth-code` flow）

### 2. ✅ 認證流程檢查

**Google 登入流程（`GoogleLoginButton.tsx`）：**
1. ✅ 使用 `useGoogleLogin` hook 獲取 authorization code
2. ✅ 發送 POST 到 `/api/auth/google/callback`
3. ✅ 後端返回 `token` 和 `refreshToken`
4. ✅ **Token 被儲存到 localStorage**（`tokenManager.setAccessToken()` 和 `tokenManager.setRefreshToken()`）
5. ✅ **Auth store 被更新**（`setUser()`, `setToken()`, `setRefreshToken()`）

**結論：** Token 儲存流程是正確的！

### 3. ❌ **關鍵問題：API 調用沒有使用 token**

**問題根源：** 應用中有兩個不同的 API 客戶端：

1. **`api-client.ts`** - 使用 axios，**有 interceptor 會自動添加 Authorization header**
2. **`queryClient.ts`** - 使用原生 fetch，**沒有添加 Authorization header**

**當前狀況：**
- `GoogleLoginButton` 正確儲存 token 到 localStorage
- `api-client.ts` 的 `apiClient` 有 interceptor 會自動添加 Authorization header
- **但** 很多組件（如 Dashboard）使用 React Query，它使用 `queryClient.ts` 的 `getQueryFn`
- `getQueryFn` 使用原生 `fetch`，**沒有添加 Authorization header**

### 4. ❌ **缺失的功能**

**`queryClient.ts` 的 `getQueryFn` 函數沒有添加 Authorization header**

```typescript
// 當前實現（錯誤）
const res = await fetch(fullUrl, {
  credentials: "include",
  // ❌ 沒有 Authorization header！
});
```

**應該改為：**
```typescript
const token = tokenManager.getAccessToken();
const headers: HeadersInit = {};
if (token) {
  headers.Authorization = `Bearer ${token}`;
}

const res = await fetch(fullUrl, {
  headers,
  credentials: "include",
});
```

## 修復方案

### 方案 1：修復 `queryClient.ts`（推薦）

在 `queryClient.ts` 的 `getQueryFn` 和 `apiRequest` 函數中添加 Authorization header。

### 方案 2：統一使用 `apiClient`

將所有 API 調用改為使用 `api-client.ts` 的 `apiClient`，而不是 `queryClient.ts`。

**推薦方案 1**，因為：
- 修改較少
- 保持現有的 React Query 結構
- 只需要在 `queryClient.ts` 中添加 token 支持

## 需要的修改

1. **修改 `client/src/lib/queryClient.ts`**：
   - 在 `apiRequest` 函數中添加 Authorization header
   - 在 `getQueryFn` 函數中添加 Authorization header
   - 導入 `tokenManager` 以獲取 token

2. **確保所有 API 調用都使用 token**：
   - 檢查 dashboard 和其他頁面的 API 調用
   - 確認它們都通過 `queryClient` 或 `apiClient` 進行調用

