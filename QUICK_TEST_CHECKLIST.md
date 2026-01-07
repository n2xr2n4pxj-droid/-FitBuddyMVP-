# 🚀 快速測試檢查清單

## ⚡ 5 分鐘快速測試

### 1. 登入並檢查 Token ✅
- [ ] 使用 Google OAuth 登入
- [ ] 打開 DevTools → Application → Local Storage
- [ ] 檢查是否有 `fitbuddy_access_token` 和 `fitbuddy_refresh_token`
- [ ] 檢查是否有 `accessToken` 和 `refreshToken`（向後兼容）

### 2. 測試 Meals API ✅
- [ ] 打開 Dashboard 或 Meals 頁面
- [ ] 檢查 Network 標籤：
  - [ ] `GET /api/meals` 請求包含 `Authorization: Bearer <token>`
  - [ ] 響應狀態: 200 OK
- [ ] 創建一個新餐點
- [ ] 檢查：
  - [ ] `POST /api/meals` 請求成功
  - [ ] 餐點列表自動更新
- [ ] 刪除一個餐點
- [ ] 檢查：
  - [ ] `DELETE /api/meals/{id}` 請求成功
  - [ ] 餐點從列表中消失

### 3. 測試 TDEE API ✅
- [ ] 打開 Dashboard
- [ ] 檢查 Network 標籤：
  - [ ] `GET /api/tdee/profile` 請求包含 Authorization header
  - [ ] `GET /api/tdee/today-progress` 請求包含 Authorization header
  - [ ] 響應狀態: 200 OK
- [ ] 打開 TDEE Calculator
- [ ] 填寫信息並計算
- [ ] 檢查：
  - [ ] `POST /api/tdee/calculate` 請求成功
  - [ ] 顯示計算結果

### 4. 測試 Workouts API ✅
- [ ] 打開 Dashboard
- [ ] 檢查 Network 標籤：
  - [ ] `GET /api/workouts` 請求包含 Authorization header
  - [ ] 響應狀態: 200 OK
- [ ] 創建一個新訓練記錄
- [ ] 檢查：
  - [ ] `POST /api/workouts` 請求成功
  - [ ] 訓練列表自動更新

### 5. 檢查 Console ✅
- [ ] 打開 Console 標籤
- [ ] 檢查：
  - [ ] 無紅色錯誤信息
  - [ ] 無 401 Unauthorized 錯誤
  - [ ] 無 CORS 錯誤

## 🔍 詳細檢查點

### Network 標籤檢查
每個 API 請求應該：
- ✅ 包含 `Authorization: Bearer <token>` header
- ✅ 狀態碼: 200, 201, 204（成功）或適當的錯誤碼
- ✅ 響應時間合理（< 1 秒）

### Console 檢查
應該看到：
- ✅ 正常的日誌信息（如果有）
- ❌ 無錯誤堆棧
- ❌ 無 "Failed to fetch" 錯誤
- ❌ 無 "401 Unauthorized" 錯誤

### UI 檢查
- ✅ Loading 狀態正確顯示和消失
- ✅ 錯誤信息正確顯示（如果有錯誤）
- ✅ 數據正確顯示
- ✅ 操作後 UI 自動更新

## ⚠️ 如果發現問題

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

## ✅ 測試通過標準

- [ ] 所有 API 請求都包含 Authorization header
- [ ] 所有 API 請求都返回成功狀態（200, 201, 204）
- [ ] 無 Console 錯誤
- [ ] UI 正確響應
- [ ] 數據自動更新

## 📝 測試結果記錄

```
測試日期: ___________
測試人員: ___________

登入: ✅ / ❌
Meals API: ✅ / ❌
TDEE API: ✅ / ❌
Workouts API: ✅ / ❌
Console 錯誤: ✅ / ❌

問題記錄:
_______________________________________
_______________________________________
_______________________________________
```

