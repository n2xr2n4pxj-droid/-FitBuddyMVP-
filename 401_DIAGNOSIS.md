# 🔍 401 Unauthorized 問題診斷報告

## 📊 問題現象

從終端輸出和 Console 可以看到：
- ✅ Google 登入成功：`POST /api/auth/google/callback 200`
- ✅ Token 生成成功
- ❌ 所有 API 請求返回 401：`GET /api/meals`, `/api/workouts` 等
- ✅ Token 刷新成功：`POST /api/auth/refresh 200`
- ❌ **刷新後還是 401**（關鍵問題）

## 🔍 根本原因分析

### 問題 1: 缺少 queryFn ⚠️

**發現：** Console 顯示多個警告：
```
No queryFn was passed as an option, and no default queryFn was found
```

**影響的文件：**
- `dashboard.tsx` - `useQuery` for `/api/summary/daily` 和 `/api/meals`
- `weekly-chart.tsx` - `useQuery` for `/api/summary/weekly`

**後果：** 這些查詢不會執行，或者使用錯誤的配置。

### 問題 2: Token 刷新後仍返回 401 🔴（關鍵問題）

**觀察：**
1. Token 刷新成功（`POST /api/auth/refresh 200`）
2. 但刷新後的請求還是 401

**可能的原因：**

#### 原因 A: Token 刷新後沒有更新到 localStorage
- 檢查 `api-client.ts` 中的 token 刷新邏輯
- 確認 `tokenManager.setAccessToken()` 是否被調用

#### 原因 B: 刷新後的 token 沒有被使用
- 檢查請求攔截器是否正確獲取最新的 token
- 確認刷新後的請求是否使用新 token

#### 原因 C: Token 刷新邏輯有競態條件
- 多個請求同時收到 401，可能導致多個刷新請求
- 需要確保只有一個刷新請求，其他請求等待

## 🔧 診斷步驟

### 步驟 1: 檢查 Token 是否正確保存

在 Console 中執行：
```javascript
console.log('Access Token:', localStorage.getItem('fitbuddy_access_token'));
console.log('Refresh Token:', localStorage.getItem('fitbuddy_refresh_token'));
console.log('Access Token (legacy):', localStorage.getItem('accessToken'));
```

**預期：** 應該有值

### 步驟 2: 檢查 Token 刷新邏輯

檢查 `api-client.ts` 中的 token 刷新：
1. 刷新成功後是否調用 `tokenManager.setAccessToken()`？
2. 刷新後的請求是否使用新 token？

### 步驟 3: 檢查請求攔截器

檢查 `apiClient.interceptors.request`：
1. 是否正確獲取 token？
2. 是否正確添加到 Authorization header？

## 🐛 發現的問題

### 問題 1: 請求攔截器中的 Token 刷新邏輯

在 `api-client.ts` 的請求攔截器中（第 124-143 行），有一個問題：

```typescript
if (tokenManager.isAccessTokenExpired()) {
  const refreshToken = tokenManager.getRefreshToken();
  if (refreshToken) {
    try {
      const baseURL = import.meta.env.VITE_API_BASE_URL || '';
      const response = await axios.post<RefreshTokenResponse>(
        `${baseURL}/api/auth/refresh`,
        { refreshToken }
      );
      tokenManager.setAccessToken(response.data.token);
      tokenManager.setRefreshToken(response.data.refreshToken);
    } catch (error) {
      // ...
    }
  }
}
```

**問題：** 這裡使用了 `axios.post` 而不是 `apiClient.post`，這意味著：
- 不會使用 `apiClient` 的 baseURL
- 不會使用 `apiClient` 的配置
- 可能導致 URL 構建錯誤

### 問題 2: 響應攔截器中的 Token 刷新

在響應攔截器中（第 195-198 行），也有同樣的問題：

```typescript
const response = await axios.post<RefreshTokenResponse>(
  `${baseURL}/api/auth/refresh`,
  { refreshToken }
);
```

**問題：** 使用 `axios.post` 而不是 `apiClient.post`，可能導致：
- baseURL 不正確
- 請求配置不一致

### 問題 3: 刷新後的 Token 沒有立即使用

刷新 token 後，當前的請求配置可能已經設置了舊的 token，需要更新。

## 🔧 修復方案

### 修復 1: 統一使用 apiClient 進行 token 刷新

**問題：** 使用 `axios.post` 而不是 `apiClient.post`

**修復：** 但這裡有個循環依賴問題：
- `apiClient` 的 interceptor 需要調用 refresh
- 但 refresh 需要使用 `apiClient`

**解決方案：** 創建一個獨立的 refresh 函數，或者使用原始的 axios 實例（但要確保 baseURL 正確）。

### 修復 2: 確保刷新後的 Token 被使用

刷新 token 後，需要：
1. 更新 localStorage
2. 更新當前請求的 Authorization header
3. 重試原始請求

## 📋 待修復項目

1. ✅ 修復 `dashboard.tsx` 中缺少的 `queryFn`
2. ✅ 修復 `weekly-chart.tsx` 中缺少的 `queryFn`
3. ⚠️ 檢查並修復 token 刷新邏輯
4. ⚠️ 確保刷新後的 token 被正確使用

