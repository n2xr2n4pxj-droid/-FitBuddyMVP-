# 🔍 401 Unauthorized 根本原因分析

## 📊 問題現象

從終端輸出可以看到：
```
[🔌API] POST /api/auth/google/callback 200 ✅
[🔌API] GET /api/meals/2026-01-06 401 ❌
[🔌API] POST /api/auth/refresh 200 ✅
[🔌API] GET /api/meals/2026-01-06 401 ❌ (刷新後還是 401)
```

## 🔍 根本原因

### 原因 1: Token 刷新後沒有更新請求 Header ⚠️

**問題位置：** `client/src/lib/api-client.ts` 第 209-210 行

**問題代碼：**
```typescript
// 刷新 token 後
tokenManager.setAccessToken(newAccessToken);
onRefreshed(newAccessToken);

// ❌ 問題：原始請求的 header 還是舊的 token
return apiClient(originalRequest);
```

**原因：** 
- `originalRequest` 的 `Authorization` header 在第一次請求時已經設置為舊的 token
- 刷新 token 後，雖然更新了 `localStorage`，但 `originalRequest.headers.Authorization` 還是舊的值
- 重試請求時，使用的是舊的 token，所以還是 401

**修復：**
```typescript
// ✅ 修復：更新原始請求的 Authorization header
originalRequest.headers = originalRequest.headers || {};
originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
return apiClient(originalRequest);
```

### 原因 2: baseURL 可能為空字符串 ⚠️

**問題位置：** `client/src/lib/api-client.ts` 第 128 和 194 行

**問題代碼：**
```typescript
const baseURL = import.meta.env.VITE_API_BASE_URL || '';
const response = await axios.post<RefreshTokenResponse>(
  `${baseURL}/api/auth/refresh`, // 如果 baseURL 是 ''，URL 會是 '/api/auth/refresh'
  { refreshToken }
);
```

**原因：**
- 如果 `VITE_API_BASE_URL` 未設置，`baseURL` 會是空字符串
- 這會導致 URL 變成 `/api/auth/refresh`（相對路徑）
- 在瀏覽器環境中，這可能會導致請求發送到錯誤的地址

**修復：**
```typescript
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
```

### 原因 3: 請求攔截器中的 Token 刷新後沒有更新 Header ⚠️

**問題位置：** `client/src/lib/api-client.ts` 第 133-134 行

**問題代碼：**
```typescript
tokenManager.setAccessToken(response.data.token);
tokenManager.setRefreshToken(response.data.refreshToken);
// ❌ 問題：沒有更新當前請求的 Authorization header
```

**原因：**
- 在請求攔截器中刷新 token 後，雖然更新了 `localStorage`，但當前請求的 `config.headers.Authorization` 還是舊的值
- 後續的請求會從 `tokenManager.getAccessToken()` 獲取新 token，但當前請求已經設置了舊的 header

**修復：**
```typescript
tokenManager.setAccessToken(response.data.token);
tokenManager.setRefreshToken(response.data.refreshToken);

// ✅ 修復：更新當前請求的 Authorization header
config.headers.Authorization = `Bearer ${response.data.token}`;
```

### 原因 4: 缺少 queryFn（導致警告，但不影響 401）⚠️

**問題位置：** 
- `dashboard.tsx` 第 380-383 行
- `dashboard.tsx` 第 385-388 行
- `weekly-chart.tsx` 第 14-16 行

**問題代碼：**
```typescript
const { data: todaySummary } = useQuery<DailySummary>({
  queryKey: ["/api/summary/daily", today],
  // ❌ 缺少 queryFn
  enabled: isAuthenticated,
});
```

**原因：**
- React Query 需要 `queryFn` 來執行查詢
- 如果沒有 `queryFn`，查詢不會執行，或者使用錯誤的配置

**修復：**
```typescript
const { data: todaySummary } = useQuery<DailySummary>({
  queryKey: ["/api/summary/daily", today],
  queryFn: createQueryFn<DailySummary>(), // ✅ 添加
  enabled: isAuthenticated,
});
```

## ✅ 已修復的問題

1. ✅ **Token 刷新後更新請求 Header** - 修復響應攔截器
2. ✅ **baseURL 默認值** - 設置為 `'http://localhost:3000'`
3. ✅ **請求攔截器中的 Header 更新** - 刷新後立即更新
4. ✅ **添加 queryFn** - 修復所有缺少 `queryFn` 的查詢

## 🎯 預期效果

修復後：
1. ✅ Token 刷新成功後，新 token 會被正確使用
2. ✅ API 請求不再返回 401（如果 token 有效）
3. ✅ 不再有 "No queryFn" 警告

## 📋 測試驗證

1. **清除 localStorage 並重新登入**
2. **檢查 Console** - 不應該有 "No queryFn" 警告
3. **檢查 Network 標籤** - 請求應該有正確的 `Authorization` header
4. **等待 token 過期或手動清除 access token** - 應該自動刷新並重試請求

