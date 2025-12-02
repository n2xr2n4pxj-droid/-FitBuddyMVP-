# USDA API Key 設置指南

## 問題
如果營養數據庫搜索沒有返回結果，可能是因為使用了 `DEMO_KEY`，它可能有限制或無法正常工作。

## 解決方案：獲取免費的 USDA API Key

### 步驟 1：註冊 USDA API Key
1. 訪問 [USDA FoodData Central API 指南](https://fdc.nal.usda.gov/api-guide.html)
2. 點擊 "Get an API Key" 或訪問 [API Key 註冊頁面](https://fdc.nal.usda.gov/api-key-signup.html)
3. 填寫註冊表單（免費）
4. 檢查您的電子郵件並確認註冊
5. 您將收到一個 API Key

### 步驟 2：設置環境變量
在項目的 `.env` 文件中更新 `USDA_API_KEY`：

```bash
USDA_API_KEY=your-actual-api-key-here
```

### 步驟 3：重啟服務器
更新 `.env` 文件後，需要重啟開發服務器：

```bash
npm run dev
```

## 注意事項
- USDA API Key 是免費的
- 有每日請求限制（通常足夠開發使用）
- `DEMO_KEY` 可能不會返回結果或有限制

## 測試
設置 API Key 後，嘗試搜索 "chicken breast" 或其他食物，應該會看到結果。


