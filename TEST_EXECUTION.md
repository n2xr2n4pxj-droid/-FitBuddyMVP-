# 🧪 測試執行指南

## ⚡ 快速開始測試

### 前置條件
1. ✅ 確保後端服務器正在運行（`npm run dev:backend`）
2. ✅ 確保前端服務器正在運行（`npm run dev:frontend`）
3. ✅ 打開瀏覽器 DevTools（F12）

### 測試環境準備
1. 打開瀏覽器：`http://localhost:5173`
2. 打開 DevTools：
   - **Network 標籤** - 監控所有 API 請求
   - **Console 標籤** - 查看日誌和錯誤
   - **Application 標籤** - 檢查 localStorage

## 📋 逐步測試流程

### 步驟 1: 登入測試 ✅

1. **使用 Google OAuth 登入**
   - 點擊 "Google 登錄" 按鈕
   - 完成 Google 認證流程

2. **檢查 Token 保存**
   - 打開 DevTools → Application → Local Storage
   - 檢查以下 keys：
     - ✅ `fitbuddy_access_token` - 應該有值
     - ✅ `fitbuddy_refresh_token` - 應該有值
     - ✅ `accessToken` - 應該有值（向後兼容）
     - ✅ `refreshToken` - 應該有值（向後兼容）

3. **檢查 Console**
   - 應該看到：`[GoogleLoginButton] ✅ Token saved confirmation`
   - 無錯誤信息

**預期結果：** ✅ 登入成功，tokens 正確保存

---

### 步驟 2: Meals API 測試 ✅

#### 2.1 獲取所有餐點
1. 打開 Dashboard 或 Meals 頁面
2. 檢查 Network 標籤：
   - 查找 `GET /api/meals` 請求
   - ✅ 請求應該包含 `Authorization: Bearer <token>` header
   - ✅ 響應狀態應該是 `200 OK`
3. 檢查 UI：
   - ✅ 餐點列表正確顯示
   - ✅ 無 loading 狀態（數據已加載）

**預期結果：** ✅ 餐點列表成功加載

#### 2.2 獲取今天的餐點
1. 打開 Dashboard（應該自動顯示今天的餐點）
2. 檢查 Network 標籤：
   - 查找 `GET /api/meals/2026-01-XX` 請求（今天的日期）
   - ✅ 請求包含 Authorization header
   - ✅ 響應狀態 `200 OK`
3. 測試緩存：
   - 切換到其他頁面
   - 返回 Dashboard
   - ✅ 數據應該立即顯示（從緩存）

**預期結果：** ✅ 今天的餐點成功加載，緩存正常工作

#### 2.3 創建新餐點
1. 打開 Meal Form（在 Dashboard 或獨立頁面）
2. 填寫餐點信息：
   - 名稱：測試餐點
   - 卡路里：500
   - 蛋白質：30
   - 碳水：50
   - 脂肪：20
3. 點擊提交
4. 檢查 Network 標籤：
   - 查找 `POST /api/meals` 請求
   - ✅ 請求包含 Authorization header
   - ✅ 請求 body 包含正確的數據
   - ✅ 響應狀態 `200` 或 `201`
5. 檢查 UI：
   - ✅ 顯示成功 toast："Meal logged!"
   - ✅ 餐點列表自動更新（不需要手動刷新）
   - ✅ 表單重置

**預期結果：** ✅ 餐點創建成功，UI 自動更新

#### 2.4 刪除餐點
1. 在餐點列表中找到一個餐點
2. 點擊刪除按鈕
3. 確認刪除
4. 檢查 Network 標籤：
   - 查找 `DELETE /api/meals/{mealId}` 請求
   - ✅ 請求包含 Authorization header
   - ✅ 響應狀態 `200` 或 `204`
5. 檢查 UI：
   - ✅ 餐點從列表中消失
   - ✅ 相關統計數據自動更新

**預期結果：** ✅ 餐點刪除成功，UI 自動更新

---

### 步驟 3: TDEE API 測試 ✅

#### 3.1 獲取 TDEE Profile
1. 打開 Dashboard
2. 檢查 Network 標籤：
   - 查找 `GET /api/tdee/profile` 請求
   - ✅ 請求包含 Authorization header
   - ✅ 響應狀態 `200 OK`
3. 檢查 UI：
   - ✅ 如果用戶有配置，顯示正確的數據
   - ✅ 如果沒有配置，顯示空值或默認值

**預期結果：** ✅ TDEE Profile 成功加載

#### 3.2 獲取今日進度
1. 打開 Dashboard
2. 檢查 Network 標籤：
   - 查找 `GET /api/tdee/today-progress` 請求
   - ✅ 請求包含 Authorization header
   - ✅ 響應狀態 `200 OK`
3. 檢查 UI：
   - ✅ 顯示今日進度（卡路里、蛋白質、碳水、脂肪）
   - ✅ 進度條正確顯示
4. 等待 30 秒：
   - ✅ 應該自動刷新（根據配置）

**預期結果：** ✅ 今日進度成功加載，自動刷新正常工作

#### 3.3 計算 TDEE
1. 打開 TDEE Calculator
2. 填寫所有必填字段：
   - 年齡：30
   - 性別：Male
   - 身高：175 cm
   - 體重：70 kg
   - 活動水平：Moderately Active
3. 點擊計算按鈕
4. 檢查 Network 標籤：
   - 查找 `POST /api/tdee/calculate` 請求
   - ✅ 請求包含 Authorization header
   - ✅ 請求 body 包含正確的參數
   - ✅ 響應狀態 `200`
5. 檢查 UI：
   - ✅ 顯示計算結果（BMR, TDEE, 宏量營養素）
   - ✅ 顯示成功 toast
   - ✅ 可以保存到 profile

**預期結果：** ✅ TDEE 計算成功，結果正確顯示

---

### 步驟 4: Workouts API 測試 ✅

#### 4.1 獲取訓練記錄
1. 打開 Dashboard
2. 檢查 Network 標籤：
   - 查找 `GET /api/workouts` 請求
   - ✅ 請求包含 Authorization header
   - ✅ 響應狀態 `200 OK`
3. 檢查 UI：
   - ✅ 訓練記錄列表正確顯示

**預期結果：** ✅ 訓練記錄成功加載

#### 4.2 創建訓練記錄
1. 在 Dashboard 中填寫訓練信息：
   - 運動類型：Strength Training
   - 運動名稱：Bench Press
   - 組數：3
   - 次數：10
   - 重量：80 kg
2. 點擊提交
3. 檢查 Network 標籤：
   - 查找 `POST /api/workouts` 請求
   - ✅ 請求包含 Authorization header
   - ✅ 請求 body 包含正確的數據
   - ✅ 響應狀態 `200` 或 `201`
4. 檢查 UI：
   - ✅ 訓練記錄添加到列表
   - ✅ 相關統計數據自動更新

**預期結果：** ✅ 訓練記錄創建成功，UI 自動更新

#### 4.3 刪除訓練記錄
1. 在訓練列表中找到一個記錄
2. 點擊刪除按鈕
3. 確認刪除
4. 檢查 Network 標籤：
   - 查找 `DELETE /api/workouts/{id}` 請求
   - ✅ 請求包含 Authorization header
   - ✅ 響應狀態 `200` 或 `204`
5. 檢查 UI：
   - ✅ 訓練記錄從列表中消失

**預期結果：** ✅ 訓練記錄刪除成功

---

### 步驟 5: Nutrition Search 測試 ✅

1. 打開 Meal Form
2. 在搜索框輸入食物名稱（例如："chicken"）
3. 等待至少 2 秒（搜索需要至少 2 個字符）
4. 檢查 Network 標籤：
   - 查找 `GET /api/nutrition/search/chicken` 請求
   - ✅ 請求包含 Authorization header
   - ✅ 響應狀態 `200 OK`
5. 檢查 UI：
   - ✅ 顯示搜索結果列表
   - ✅ 可以選擇食物
   - ✅ 選擇後，食物信息填充到表單

**預期結果：** ✅ 食物搜索正常工作

---

### 步驟 6: Token 刷新測試 🔐

#### 6.1 自動 Token 刷新（模擬）
1. 登入系統
2. 打開 Console
3. 手動修改 token 使其過期（僅用於測試）：
   ```javascript
   // 在 Console 中執行（僅用於測試）
   localStorage.setItem('fitbuddy_access_token', 'expired_token');
   ```
4. 執行任何 API 調用（例如：刷新頁面）
5. 檢查 Network 標籤：
   - ✅ 如果收到 401，應該自動調用 `/api/auth/refresh`
   - ✅ 刷新成功後，原始請求應該自動重試
   - ✅ 不需要用戶重新登入

**預期結果：** ✅ Token 自動刷新機制正常工作

---

### 步驟 7: 錯誤處理測試 ⚠️

#### 7.1 檢查 Console 錯誤
1. 打開 Console 標籤
2. 執行所有上述測試
3. 檢查：
   - ✅ 無紅色錯誤信息
   - ✅ 無 401 Unauthorized 錯誤（除非測試 token 刷新）
   - ✅ 無 CORS 錯誤
   - ✅ 無網絡錯誤

**預期結果：** ✅ 無 Console 錯誤

---

## 📊 測試結果記錄表

| 測試項目 | 狀態 | 備註 |
|---------|------|------|
| 登入和 Token 保存 | ⬜ | |
| 獲取所有餐點 | ⬜ | |
| 獲取今天的餐點 | ⬜ | |
| 創建新餐點 | ⬜ | |
| 刪除餐點 | ⬜ | |
| 獲取 TDEE Profile | ⬜ | |
| 獲取今日進度 | ⬜ | |
| 計算 TDEE | ⬜ | |
| 獲取訓練記錄 | ⬜ | |
| 創建訓練記錄 | ⬜ | |
| 刪除訓練記錄 | ⬜ | |
| 食物搜索 | ⬜ | |
| Token 自動刷新 | ⬜ | |
| Console 無錯誤 | ⬜ | |

## ✅ 測試通過標準

所有以下項目都應該通過：
- [ ] 所有 API 請求都包含 `Authorization: Bearer <token>` header
- [ ] 所有 API 請求都返回成功狀態（200, 201, 204）
- [ ] 無 Console 錯誤
- [ ] UI 正確響應
- [ ] 數據自動更新（不需要手動刷新）
- [ ] Token 刷新機制正常工作

## 🐛 如果發現問題

### 問題: 401 Unauthorized
1. 檢查 localStorage 中的 tokens
2. 檢查 Network 標籤中的 Authorization header
3. 嘗試重新登入

### 問題: 數據未更新
1. 檢查 React Query DevTools（如果安裝）
2. 檢查 Console 中的錯誤
3. 手動刷新頁面

### 問題: Loading 狀態不消失
1. 檢查 Network 標籤中的請求狀態
2. 檢查 Console 中的錯誤
3. 檢查請求是否完成

## 📝 測試完成後

1. 記錄所有測試結果
2. 記錄發現的問題
3. 修復問題
4. 重新測試

---

**測試開始時間：** ___________
**測試完成時間：** ___________
**測試人員：** ___________

