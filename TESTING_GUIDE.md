# FitBuddy API 遷移測試指南

## 🧪 測試目標

測試所有已遷移到 React Query + Axios 統一方案的功能，確保：
- ✅ API 調用正常工作
- ✅ Token 刷新機制正常
- ✅ 錯誤處理正確
- ✅ 緩存和狀態管理正常
- ✅ UI 響應正確

## 📋 測試檢查清單

### 1. Meals API 測試 ✅

#### 1.1 獲取所有餐點 (`useMeals`)
- [ ] 打開 Dashboard 或 Meals 頁面
- [ ] 檢查是否成功加載餐點列表
- [ ] 檢查 Network 標籤：
  - [ ] 請求 URL: `GET /api/meals`
  - [ ] 請求包含 `Authorization: Bearer <token>` header
  - [ ] 響應狀態: 200 OK
- [ ] 檢查 Console：
  - [ ] 無錯誤信息
  - [ ] 數據正確顯示

#### 1.2 獲取今天的餐點 (`useTodaysMeals`)
- [ ] 打開 Today's Meals 頁面或 Dashboard
- [ ] 檢查是否成功加載今天的餐點
- [ ] 檢查 Network 標籤：
  - [ ] 請求 URL: `GET /api/meals/2026-01-XX` (今天的日期)
  - [ ] 請求包含 Authorization header
  - [ ] 響應狀態: 200 OK
- [ ] 測試緩存：
  - [ ] 切換頁面後返回，數據應該從緩存加載（不發送新請求）

#### 1.3 創建餐點 (`MealForm` 組件)
- [ ] 打開 Meal Form
- [ ] 填寫餐點信息並提交
- [ ] 檢查 Network 標籤：
  - [ ] 請求 URL: `POST /api/meals`
  - [ ] 請求包含 Authorization header
  - [ ] 請求 body 包含正確的數據
  - [ ] 響應狀態: 200 或 201
- [ ] 檢查 UI：
  - [ ] 成功後顯示 toast 通知
  - [ ] 餐點列表自動更新（不需要手動刷新）
  - [ ] 表單重置

#### 1.4 刪除餐點 (`useDeleteMeal`)
- [ ] 在餐點列表中點擊刪除按鈕
- [ ] 確認刪除操作
- [ ] 檢查 Network 標籤：
  - [ ] 請求 URL: `DELETE /api/meals/{mealId}`
  - [ ] 請求包含 Authorization header
  - [ ] 響應狀態: 200 或 204
- [ ] 檢查 UI：
  - [ ] 餐點從列表中消失
  - [ ] 相關統計數據自動更新

#### 1.5 更新餐點 (`useUpdateMeal`)
- [ ] 編輯現有餐點
- [ ] 修改信息並保存
- [ ] 檢查 Network 標籤：
  - [ ] 請求 URL: `PATCH /api/meals/{mealId}`
  - [ ] 請求包含 Authorization header
  - [ ] 請求 body 包含更新的數據
  - [ ] 響應狀態: 200
- [ ] 檢查 UI：
  - [ ] 餐點信息已更新
  - [ ] 相關統計數據自動更新

### 2. TDEE API 測試 ✅

#### 2.1 獲取 TDEE Profile (`useTDEEProfile`)
- [ ] 打開 TDEE Calculator 或 Dashboard
- [ ] 檢查是否成功加載 TDEE 配置
- [ ] 檢查 Network 標籤：
  - [ ] 請求 URL: `GET /api/tdee/profile`
  - [ ] 請求包含 Authorization header
  - [ ] 響應狀態: 200 OK
- [ ] 檢查數據：
  - [ ] 如果用戶有配置，顯示正確的數據
  - [ ] 如果用戶沒有配置，顯示空值或默認值

#### 2.2 計算 TDEE (`useCalculateTDEE`)
- [ ] 打開 TDEE Calculator
- [ ] 填寫所有必填字段（年齡、性別、身高、體重、活動水平）
- [ ] 點擊計算按鈕
- [ ] 檢查 Network 標籤：
  - [ ] 請求 URL: `POST /api/tdee/calculate`
  - [ ] 請求包含 Authorization header
  - [ ] 請求 body 包含正確的參數
  - [ ] 響應狀態: 200
- [ ] 檢查 UI：
  - [ ] 顯示計算結果（BMR, TDEE, 宏量營養素）
  - [ ] 顯示成功 toast
  - [ ] 可以保存到 profile

#### 2.3 獲取今日進度 (`useTodayProgress`)
- [ ] 打開 Dashboard
- [ ] 檢查是否顯示今日進度（卡路里、蛋白質、碳水、脂肪）
- [ ] 檢查 Network 標籤：
  - [ ] 請求 URL: `GET /api/tdee/today-progress`
  - [ ] 請求包含 Authorization header
  - [ ] 響應狀態: 200 OK
- [ ] 檢查自動刷新：
  - [ ] 每 30 秒自動刷新（根據配置）
  - [ ] 數據實時更新

### 3. Workouts API 測試 ✅

#### 3.1 創建訓練記錄 (`WorkoutForm` 組件)
- [ ] 打開 Workout Form
- [ ] 填寫訓練信息並提交
- [ ] 檢查 Network 標籤：
  - [ ] 請求 URL: `POST /api/workouts`
  - [ ] 請求包含 Authorization header
  - [ ] 請求 body 包含正確的數據
  - [ ] 響應狀態: 200 或 201
- [ ] 檢查 UI：
  - [ ] 成功後顯示 toast
  - [ ] 訓練列表自動更新

### 4. Nutrition Search 測試 ✅

#### 4.1 搜索食物 (`MealForm` 中的搜索)
- [ ] 打開 Meal Form
- [ ] 在搜索框輸入食物名稱（至少 2 個字符）
- [ ] 檢查 Network 標籤：
  - [ ] 請求 URL: `GET /api/nutrition/search/{query}`
  - [ ] 請求包含 Authorization header
  - [ ] 響應狀態: 200 OK
- [ ] 檢查 UI：
  - [ ] 顯示搜索結果列表
  - [ ] 可以選擇食物
  - [ ] 搜索結果正確顯示

### 5. Token 刷新測試 🔐

#### 5.1 自動 Token 刷新
- [ ] 登入系統
- [ ] 等待 token 接近過期（或手動修改 token 使其過期）
- [ ] 執行任何 API 調用
- [ ] 檢查 Network 標籤：
  - [ ] 如果收到 401，應該自動調用 `/api/auth/refresh`
  - [ ] 刷新成功後，原始請求應該自動重試
  - [ ] 不需要用戶重新登入

#### 5.2 Token 刷新失敗處理
- [ ] 清除 refresh token（模擬過期）
- [ ] 執行 API 調用
- [ ] 檢查行為：
  - [ ] 應該自動重定向到登入頁面
  - [ ] 顯示適當的錯誤信息

### 6. 錯誤處理測試 ⚠️

#### 6.1 網絡錯誤
- [ ] 斷開網絡連接
- [ ] 執行 API 調用
- [ ] 檢查 UI：
  - [ ] 顯示適當的錯誤信息
  - [ ] 不會崩潰

#### 6.2 401 未授權錯誤
- [ ] 清除所有 tokens
- [ ] 執行 API 調用
- [ ] 檢查行為：
  - [ ] 應該重定向到登入頁面
  - [ ] 或顯示未授權錯誤

#### 6.3 400/500 錯誤
- [ ] 提交無效數據（如果可能）
- [ ] 檢查 UI：
  - [ ] 顯示錯誤信息
  - [ ] 不會崩潰

### 7. 緩存和狀態管理測試 💾

#### 7.1 Query 緩存
- [ ] 加載餐點列表
- [ ] 切換到其他頁面
- [ ] 返回餐點頁面
- [ ] 檢查：
  - [ ] 數據立即顯示（從緩存）
  - [ ] 可能發送背景刷新請求

#### 7.2 Query Invalidation
- [ ] 創建新餐點
- [ ] 檢查：
  - [ ] 餐點列表自動更新
  - [ ] 相關查詢（如今日進度）自動更新

#### 7.3 Loading 狀態
- [ ] 執行任何 API 調用
- [ ] 檢查 UI：
  - [ ] 顯示 loading 狀態（如果配置）
  - [ ] Loading 狀態在請求完成後消失

## 🔍 測試工具

### Browser DevTools
1. **Network 標籤**
   - 檢查所有 API 請求
   - 檢查請求 headers（特別是 Authorization）
   - 檢查響應狀態和數據

2. **Console 標籤**
   - 檢查錯誤信息
   - 檢查日誌輸出

3. **Application 標籤**
   - 檢查 localStorage（tokens）
   - 檢查 React Query DevTools（如果安裝）

### React Query DevTools（可選）
如果安裝了 `@tanstack/react-query-devtools`：
- 查看所有 queries 和 mutations
- 查看緩存狀態
- 手動 invalidate queries

## 📝 測試記錄模板

```
測試日期: YYYY-MM-DD
測試人員: [Your Name]

功能: [功能名稱]
測試項目: [具體測試項目]
結果: ✅ 通過 / ❌ 失敗 / ⚠️ 部分通過
問題描述: [如果有問題]
```

## 🐛 常見問題排查

### 問題 1: 401 Unauthorized
**可能原因：**
- Token 未正確設置
- Token 已過期且刷新失敗
- Authorization header 未正確添加

**排查步驟：**
1. 檢查 localStorage 中的 tokens
2. 檢查 Network 標籤中的請求 headers
3. 檢查 Console 中的錯誤信息

### 問題 2: 數據未更新
**可能原因：**
- Query 未正確 invalidate
- 緩存策略問題

**排查步驟：**
1. 檢查 React Query DevTools
2. 檢查 query keys
3. 手動 invalidate queries

### 問題 3: Loading 狀態不消失
**可能原因：**
- 請求未完成
- 錯誤未正確處理

**排查步驟：**
1. 檢查 Network 標籤
2. 檢查 Console 錯誤
3. 檢查 React Query 狀態

## ✅ 測試完成標準

所有以下項目都應該通過：
- [ ] 所有 API 調用都包含 Authorization header
- [ ] Token 刷新機制正常工作
- [ ] 錯誤處理正確
- [ ] 緩存和狀態管理正常
- [ ] UI 響應正確
- [ ] 無 Console 錯誤
- [ ] 無 Network 錯誤（除了預期的）

## 🚀 下一步

測試完成後：
1. 記錄所有發現的問題
2. 修復問題
3. 重新測試
4. 繼續遷移剩餘功能

