# 修復總結

## 問題 1: API 仍返回 401 ✅ 已修復

### 問題原因
許多 hooks 和組件直接使用 `fetch`，沒有添加 `Authorization` header。

### 修復內容
1. **導出 `getHeaders` 函數** (`client/src/lib/queryClient.ts`)
   - 將 `getHeaders` 函數改為 `export function getHeaders`

2. **修復所有 fetch 調用**，添加 Authorization header：
   - ✅ `client/src/hooks/use-meals.ts` - 所有 fetch 調用
   - ✅ `client/src/hooks/use-tdee.ts` - fetch 調用
   - ✅ `client/src/components/meal-form.tsx` - fetch 調用
   - ✅ `client/src/pages/dashboard.tsx` - 所有 fetch 調用
   - ✅ `client/src/components/tdee-calculator.tsx` - fetch 調用

### 修復方式
在所有 `fetch` 調用中添加：
```typescript
headers: getHeaders() // 或 getHeaders("application/json") 如果有 body
```

## 問題 2: 角色選擇頁面 ✅ 已修復

### 問題原因
`RoleSelection.tsx` 已經存在，但 Google 登入後直接重定向到 `/`，沒有檢查用戶是否有角色。

### 修復內容
1. **修復 Google 登入後的重定向邏輯** (`client/src/components/GoogleLoginButton.tsx`)
   - 登入成功後，檢查用戶是否有角色
   - 如果沒有角色，重定向到 `/role-selection`
   - 如果有角色，重定向到 `/`（App.tsx 會根據角色路由到對應的 dashboard）

### 現有功能（無需修改）
- ✅ `RoleSelection.tsx` 頁面已存在且功能完整
- ✅ 路由 `/role-selection` 已在 `App.tsx` 中配置
- ✅ `App.tsx` 中已有邏輯：如果用戶沒有角色，會重定向到 `/role-selection`
- ✅ 後端路由 `/api/auth/role-select` 已存在並正常工作

## 測試建議

1. **測試 API 401 問題修復**：
   - 清除瀏覽器緩存和 localStorage
   - 使用 Google OAuth 登入
   - 檢查瀏覽器開發者工具的 Network 標籤
   - 確認所有 API 請求都包含 `Authorization: Bearer <token>` header
   - 確認不再出現 401 Unauthorized 錯誤

2. **測試角色選擇功能**：
   - 清除瀏覽器緩存和 localStorage
   - 使用 Google OAuth 登入（新用戶）
   - 應該自動重定向到 `/role-selection` 頁面
   - 選擇角色後，應該重定向到對應的 dashboard

## 修改的文件

1. `client/src/lib/queryClient.ts` - 導出 `getHeaders` 函數
2. `client/src/hooks/use-meals.ts` - 添加 Authorization header
3. `client/src/hooks/use-tdee.ts` - 添加 Authorization header
4. `client/src/components/meal-form.tsx` - 添加 Authorization header
5. `client/src/pages/dashboard.tsx` - 添加 Authorization header
6. `client/src/components/tdee-calculator.tsx` - 添加 Authorization header
7. `client/src/components/GoogleLoginButton.tsx` - 修復重定向邏輯

