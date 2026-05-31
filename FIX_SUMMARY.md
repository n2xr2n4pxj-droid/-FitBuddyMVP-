# Google OAuth Token 問題修復總結

## 問題診斷結果

### ✅ 已確認正確的部分

1. **路由檢查**：
   - ❌ 不存在 `/auth/callback` 路由（這是正常的，因為使用 `@react-oauth/google` 的 `auth-code` flow，不需要 callback 路由）
   - ✅ `GoogleLoginButton` 正確處理 OAuth 流程

2. **認證流程檢查**：
   - ✅ Google 登入後，code 正確發送給 backend (`/api/auth/google/callback`)
   - ✅ Backend response 中的 `token` 和 `refreshToken` **已經被儲存**
   - ✅ 儲存位置：localStorage（通過 `tokenManager.setAccessToken()` 和 `tokenManager.setRefreshToken()`）
   - ✅ Auth store 也被正確更新（`setUser()`, `setToken()`, `setRefreshToken()`）

### ❌ 發現的問題

**核心問題：API 調用時沒有發送 Authorization header**

**原因：**
- 應用中有兩個 API 客戶端：
  1. `api-client.ts` - 使用 axios，**有 interceptor 會自動添加 Authorization header** ✅
  2. `queryClient.ts` - 使用原生 fetch，**沒有添加 Authorization header** ❌

- 很多組件（如 Dashboard）使用 React Query，它使用 `queryClient.ts` 的 `getQueryFn`
- `getQueryFn` 使用原生 `fetch`，但沒有從 `tokenManager` 獲取 token 並添加到請求中
- 導致所有通過 React Query 發出的 API 請求都返回 401 Unauthorized

## 修復方案

### 已修復：`client/src/lib/queryClient.ts`

**修改內容：**

1. **添加 tokenManager 導入**：
   ```typescript
   import { tokenManager } from "./api-client";
   ```

2. **創建 `getHeaders()` 輔助函數**：
   ```typescript
   function getHeaders(contentType?: string): HeadersInit {
     const headers: HeadersInit = {};
     
     if (contentType) {
       headers['Content-Type'] = contentType;
     }
     
     // ✅ 添加 Authorization header
     const token = tokenManager.getAccessToken();
     if (token) {
       headers.Authorization = `Bearer ${token}`;
     }
     
     return headers;
   }
   ```

3. **修復 `apiRequest()` 函數**：
   - 使用 `getHeaders()` 來獲取包含 Authorization header 的 headers

4. **修復 `getQueryFn()` 函數**：
   - 使用 `getHeaders()` 來獲取包含 Authorization header 的 headers

## 修復後的流程

1. ✅ 用戶通過 Google OAuth 登入
2. ✅ Backend 返回 `token` 和 `refreshToken`
3. ✅ Frontend 儲存 token 到 localStorage（通過 `tokenManager`）
4. ✅ Auth store 更新（通過 `setUser()`, `setToken()`, `setRefreshToken()`）
5. ✅ **現在所有 API 調用都會自動添加 Authorization header** ✨
6. ✅ Dashboard 和其他頁面的 API 請求可以正常工作

## 測試建議

1. 清除瀏覽器緩存和 localStorage
2. 使用 Google OAuth 登入
3. 檢查瀏覽器開發者工具的 Network 標籤
4. 確認所有 API 請求都包含 `Authorization: Bearer <token>` header
5. 確認不再出現 401 Unauthorized 錯誤

## 相關文件

- `client/src/lib/queryClient.ts` - 已修復
- `client/src/lib/api-client.ts` - 已有正確的 interceptor（無需修改）
- `client/src/components/GoogleLoginButton.tsx` - 正確處理 token 儲存（無需修改）
- `client/src/store/auth.store.ts` - 正確管理認證狀態（無需修改）

