# 🔧 401 Unauthorized 問題修復總結

## 🐛 發現的問題

### 問題 1: 缺少 queryFn ⚠️
**影響：** Console 顯示警告，查詢可能無法正確執行

**修復：**
- ✅ `dashboard.tsx` - 為 `/api/summary/daily` 和 `/api/meals` 添加 `queryFn: createQueryFn<T>()`
- ✅ `weekly-chart.tsx` - 為 `/api/summary/weekly` 添加 `queryFn: createQueryFn<WeeklySummary>()`

### 問題 2: Token 刷新後仍返回 401 🔴（關鍵問題）

**根本原因：**
1. **baseURL 可能為空字符串**：在 token 刷新時，如果 `VITE_API_BASE_URL` 未設置，`baseURL` 會是空字符串 `''`，導致 URL 構建錯誤
2. **刷新後的 token 沒有更新到請求 header**：刷新 token 後，原始請求的 `Authorization` header 還是舊的 token

## ✅ 已修復

### 修復 1: 添加 queryFn
```typescript
// dashboard.tsx
const { data: todaySummary } = useQuery<DailySummary>({
  queryKey: ["/api/summary/daily", today],
  queryFn: createQueryFn<DailySummary>(), // ✅ 添加
  enabled: isAuthenticated,
});

// weekly-chart.tsx
const { data: weeklySummary } = useQuery<WeeklySummary>({
  queryKey: ["/api/summary/weekly"],
  queryFn: createQueryFn<WeeklySummary>(), // ✅ 添加
});
```

### 修復 2: 修復 baseURL 默認值
```typescript
// 修復前
const baseURL = import.meta.env.VITE_API_BASE_URL || '';

// 修復後
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
```

### 修復 3: 更新刷新後的請求 header
```typescript
// 在響應攔截器中，刷新 token 後
const newAccessToken = response.data.token;
tokenManager.setAccessToken(newAccessToken);

// ✅ 更新原始請求的 Authorization header
originalRequest.headers = originalRequest.headers || {};
originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

// 重試原始請求
return apiClient(originalRequest);
```

### 修復 4: 更新請求攔截器中的 header
```typescript
// 在請求攔截器中，刷新 token 後
tokenManager.setAccessToken(response.data.token);

// ✅ 更新當前請求的 Authorization header
config.headers.Authorization = `Bearer ${response.data.token}`;
```

## 🎯 預期效果

修復後應該：
1. ✅ 不再有 "No queryFn" 警告
2. ✅ Token 刷新後，新 token 會被正確使用
3. ✅ API 請求不再返回 401（如果 token 有效）

## 📋 測試步驟

1. **清除瀏覽器緩存和 localStorage**
   ```javascript
   localStorage.clear();
   ```

2. **重新登入**
   - 使用 Google 登入
   - 檢查 Console 是否還有警告

3. **檢查 API 請求**
   - 打開 Network 標籤
   - 檢查請求的 `Authorization` header 是否正確
   - 檢查是否還有 401 錯誤

4. **測試 Token 刷新**
   - 等待 token 過期（或手動清除 access token）
   - 發起一個 API 請求
   - 檢查 token 是否被刷新
   - 檢查刷新後的請求是否成功

## 🔍 如果還有問題

如果修復後還有 401 問題，請檢查：

1. **Token 是否正確保存**
   ```javascript
   console.log('Access Token:', localStorage.getItem('fitbuddy_access_token'));
   console.log('Refresh Token:', localStorage.getItem('fitbuddy_refresh_token'));
   ```

2. **請求的 Authorization header**
   - 打開 Network 標籤
   - 檢查請求的 Headers
   - 確認 `Authorization: Bearer <token>` 存在

3. **後端 token 驗證**
   - 檢查後端是否正確驗證 token
   - 檢查 token 是否過期

4. **CORS 配置**
   - 確認後端允許來自前端的請求
   - 確認 Authorization header 被允許

