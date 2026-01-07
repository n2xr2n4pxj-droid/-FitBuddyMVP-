# ✅ 準備測試 - 所有遷移已完成

## 🎉 遷移完成狀態

### ✅ 已完成的遷移

1. **基礎架構** ✅
   - `queryClient.ts` - 完全使用 Axios
   - `createQueryFn()` - 統一 Query Function
   - `apiRequest()` - 統一 API Request

2. **Hooks** ✅
   - `use-meals.ts` - 所有方法已遷移
   - `use-tdee.ts` - 所有方法已遷移

3. **組件** ✅
   - `meal-form.tsx` - 已遷移
   - `workout-form.tsx` - 已遷移
   - `tdee-calculator.tsx` - 已遷移
   - `dashboard.tsx` - 已遷移（所有 fetch 調用）

## 🧪 測試準備

### 1. 啟動服務
```bash
# 在項目根目錄執行
npm run dev
```

這會同時啟動：
- 前端：http://localhost:5173
- 後端：http://localhost:3000

### 2. 打開瀏覽器
1. 訪問：http://localhost:5173
2. 打開 DevTools（F12）
3. 切換到以下標籤：
   - **Network** - 監控 API 請求
   - **Console** - 查看日誌和錯誤
   - **Application** - 檢查 localStorage

## 📋 快速測試流程（10 分鐘）

### 步驟 1: 登入（1 分鐘）
1. 點擊 "Google 登錄"
2. 完成認證
3. 檢查：
   - ✅ localStorage 有 4 個 tokens
   - ✅ Console 顯示 token 保存確認
   - ✅ 無錯誤信息

### 步驟 2: 測試 Meals（3 分鐘）
1. 打開 Dashboard
2. 檢查餐點列表加載
3. 創建一個新餐點
4. 檢查列表自動更新
5. 刪除一個餐點
6. 檢查列表自動更新

### 步驟 3: 測試 TDEE（2 分鐘）
1. 檢查今日進度顯示
2. 打開 TDEE Calculator
3. 填寫信息並計算
4. 檢查結果顯示

### 步驟 4: 測試 Workouts（3 分鐘）
1. 檢查訓練記錄加載
2. 創建一個新訓練記錄
3. 檢查列表自動更新
4. 刪除一個訓練記錄
5. 檢查列表自動更新

### 步驟 5: 檢查 Console（1 分鐘）
1. 檢查 Console 標籤
2. 確認無錯誤信息
3. 確認所有請求都包含 Authorization header

## 🔍 關鍵檢查點

### Network 標籤
每個 API 請求應該：
- ✅ URL 正確
- ✅ Method 正確（GET, POST, DELETE, PATCH）
- ✅ 包含 `Authorization: Bearer <token>` header
- ✅ 狀態碼: 200, 201, 204
- ✅ 響應時間 < 1 秒

### Console 標籤
應該看到：
- ✅ 正常的日誌信息
- ❌ 無紅色錯誤
- ❌ 無 "Failed to fetch"
- ❌ 無 "401 Unauthorized"（除非測試 token 刷新）

### Application 標籤
Local Storage 應該有：
- ✅ `fitbuddy_access_token`
- ✅ `fitbuddy_refresh_token`
- ✅ `accessToken`（向後兼容）
- ✅ `refreshToken`（向後兼容）

## 📝 測試記錄

使用以下模板記錄測試結果：

```
測試日期: ___________
測試人員: ___________

登入: ✅ / ❌
Meals API: ✅ / ❌
TDEE API: ✅ / ❌
Workouts API: ✅ / ❌
Console 錯誤: ✅ / ❌

發現的問題:
_______________________________________
_______________________________________
```

## 🎯 測試目標

所有以下項目都應該通過：
- [ ] 所有 API 請求都包含 Authorization header
- [ ] 所有 API 請求都返回成功狀態
- [ ] 無 Console 錯誤
- [ ] UI 正確響應
- [ ] 數據自動更新（不需要手動刷新）
- [ ] Token 刷新機制正常工作

## 📚 詳細測試指南

如果需要更詳細的測試步驟，請參考：
- `TEST_EXECUTION.md` - 詳細的逐步測試指南
- `TESTING_GUIDE.md` - 完整的測試檢查清單
- `QUICK_TEST_CHECKLIST.md` - 快速測試檢查清單

## 🚀 開始測試！

所有代碼已準備就緒，可以開始測試了！

**祝測試順利！** 🎉

