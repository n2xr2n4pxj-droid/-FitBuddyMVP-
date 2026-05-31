# 🧪 測試總結和檢查清單

## ✅ 已修復的問題

1. **`use-meals.ts`** - 修復 `apiRequest` 參數順序錯誤
2. **`dashboard.tsx`** - 遷移所有 fetch 調用到 `apiClient`
   - `loadPersonalBests()` - 使用 `apiClient.get()`
   - `handleSubmitWorkout()` - 使用 `apiClient.request()`
   - `handleDeleteWorkout()` - 使用 `apiClient.delete()`
   - `useQuery` for workouts - 使用 `apiClient.get()`

## 📋 測試檢查清單

### 🔐 認證測試
- [ ] Google OAuth 登入
- [ ] Token 保存到 localStorage（4 個 keys）
- [ ] Console 顯示 token 保存確認

### 🍽️ Meals API 測試
- [ ] 獲取所有餐點 (`GET /api/meals`)
- [ ] 獲取今天的餐點 (`GET /api/meals/{date}`)
- [ ] 創建新餐點 (`POST /api/meals`)
- [ ] 刪除餐點 (`DELETE /api/meals/{id}`)
- [ ] 更新餐點 (`PATCH /api/meals/{id}`)

### 📊 TDEE API 測試
- [ ] 獲取 TDEE Profile (`GET /api/tdee/profile`)
- [ ] 獲取今日進度 (`GET /api/tdee/today-progress`)
- [ ] 計算 TDEE (`POST /api/tdee/calculate`)

### 💪 Workouts API 測試
- [ ] 獲取訓練記錄 (`GET /api/workouts`)
- [ ] 創建訓練記錄 (`POST /api/workouts`)
- [ ] 刪除訓練記錄 (`DELETE /api/workouts/{id}`)
- [ ] 獲取個人最佳 (`GET /api/workouts/stats/personal-best`)

### 🔍 Nutrition Search 測試
- [ ] 搜索食物 (`GET /api/nutrition/search/{query}`)

### 🔄 功能測試
- [ ] 數據自動更新（不需要手動刷新）
- [ ] 緩存正常工作
- [ ] Loading 狀態正確顯示
- [ ] 錯誤處理正確

### 🔐 Token 刷新測試
- [ ] 自動 token 刷新（401 時）
- [ ] 刷新失敗處理

## 🎯 每個測試的檢查點

### Network 標籤檢查
每個 API 請求應該：
- ✅ 包含 `Authorization: Bearer <token>` header
- ✅ 狀態碼: 200, 201, 204（成功）
- ✅ 響應時間合理（< 1 秒）

### Console 檢查
應該看到：
- ✅ 正常的日誌信息
- ❌ 無錯誤堆棧
- ❌ 無 "Failed to fetch" 錯誤
- ❌ 無 "401 Unauthorized" 錯誤（除非測試 token 刷新）

### UI 檢查
- ✅ Loading 狀態正確顯示和消失
- ✅ 錯誤信息正確顯示（如果有錯誤）
- ✅ 數據正確顯示
- ✅ 操作後 UI 自動更新

## 📝 快速測試腳本

### 1. 登入測試（30 秒）
```bash
1. 打開 http://localhost:5173
2. 點擊 "Google 登錄"
3. 完成認證
4. 檢查 localStorage（4 個 tokens）
5. 檢查 Console（無錯誤）
```

### 2. Meals 測試（2 分鐘）
```bash
1. 打開 Dashboard
2. 檢查餐點列表加載
3. 創建一個新餐點
4. 檢查列表自動更新
5. 刪除一個餐點
6. 檢查列表自動更新
```

### 3. TDEE 測試（1 分鐘）
```bash
1. 打開 Dashboard
2. 檢查今日進度顯示
3. 打開 TDEE Calculator
4. 填寫信息並計算
5. 檢查結果顯示
```

### 4. Workouts 測試（2 分鐘）
```bash
1. 打開 Dashboard
2. 檢查訓練記錄加載
3. 創建一個新訓練記錄
4. 檢查列表自動更新
5. 刪除一個訓練記錄
6. 檢查列表自動更新
```

## 🐛 常見問題和解決方案

### 問題 1: 401 Unauthorized
**原因：** Token 未正確設置或已過期
**解決：**
1. 檢查 localStorage 中的 tokens
2. 重新登入
3. 檢查 Network 標籤中的 Authorization header

### 問題 2: 數據未更新
**原因：** Query 未正確 invalidate
**解決：**
1. 檢查 React Query DevTools
2. 手動刷新頁面
3. 檢查 query keys

### 問題 3: Loading 狀態不消失
**原因：** 請求未完成或錯誤未處理
**解決：**
1. 檢查 Network 標籤
2. 檢查 Console 錯誤
3. 檢查請求是否完成

## ✅ 測試通過標準

所有以下項目都應該通過：
- [ ] 所有 API 請求都包含 Authorization header
- [ ] 所有 API 請求都返回成功狀態
- [ ] 無 Console 錯誤
- [ ] UI 正確響應
- [ ] 數據自動更新
- [ ] Token 刷新機制正常工作

## 📊 測試結果模板

```
測試日期: ___________
測試人員: ___________

✅ 通過的測試:
- [列出所有通過的測試]

❌ 失敗的測試:
- [列出所有失敗的測試]

🐛 發現的問題:
- [列出所有問題]

📝 備註:
- [其他備註]
```

---

**準備開始測試！** 🚀

請按照 `TEST_EXECUTION.md` 中的詳細步驟進行測試。

