# Open Food Facts 集成驗證指南

## ✅ 集成完成狀態

### 已完成的步驟

1. ✅ **文件移動**: `server/src/routes/food.ts` → `server/routes/food.ts`
2. ✅ **響應格式統一**: 修改為與 USDA API 兼容的格式
3. ✅ **路由註冊**: 在 `server/routes.ts` 中註冊了 `/api/food` 路由
4. ✅ **導入語句**: 添加了 `import foodRoutes from "./routes/food"`

## 📍 API 端點信息

### Open Food Facts API

**端點**: `GET /api/food/search?query=<search_term>`

**認證**: 需要（使用 `isAuthenticated` middleware）

**查詢參數**:
- `query` (必需): 搜索關鍵詞，至少 2 個字符

**響應格式**:
```json
[
  {
    "fdcId": "3017624010701",
    "description": "Product Name",
    "brandName": "Brand Name",
    "servingSize": 100,
    "servingSizeUnit": "g",
    "calories": 250.5,
    "protein": 10.2,
    "carbs": 30.5,
    "fat": 5.1
  }
]
```

### 對比：USDA API

**端點**: `GET /api/nutrition/search/:query`

**響應格式**: 相同（已統一）

## 🧪 驗證步驟

### 步驟 1: 檢查文件結構

```bash
# 確認 food.ts 在正確位置
ls -la server/routes/food.ts

# 確認 routes.ts 包含導入
grep -n "foodRoutes" server/routes.ts
grep -n "/api/food" server/routes.ts
```

### 步驟 2: 啟動服務器

```bash
npm run dev
# 或
npm run dev:backend
```

### 步驟 3: 測試 API 端點

#### 使用 curl

```bash
# 首先需要登錄獲取 session cookie
# 然後測試搜索端點

curl -X GET "http://localhost:3000/api/food/search?query=apple" \
  -H "Cookie: connect.sid=<your-session-cookie>" \
  -H "Content-Type: application/json"
```

#### 使用瀏覽器（需要登錄）

1. 登錄應用
2. 打開瀏覽器開發者工具
3. 在 Console 中執行：

```javascript
fetch('/api/food/search?query=apple', {
  credentials: 'include'
})
  .then(res => res.json())
  .then(data => console.log('Open Food Facts Results:', data))
  .catch(err => console.error('Error:', err));
```

#### 使用 Postman/Insomnia

1. 設置請求方法: `GET`
2. URL: `http://localhost:3000/api/food/search?query=apple`
3. Headers: 
   - `Content-Type: application/json`
   - `Cookie: connect.sid=<session-cookie>` (從瀏覽器複製)
4. 發送請求

### 步驟 4: 驗證響應

**成功響應** (200 OK):
```json
[
  {
    "fdcId": "...",
    "description": "...",
    "brandName": "...",
    "servingSize": 100,
    "servingSizeUnit": "g",
    "calories": 52.0,
    "protein": 0.3,
    "carbs": 14.0,
    "fat": 0.2
  }
]
```

**錯誤響應** (400 Bad Request):
```json
{
  "error": "Query required and must be at least 2 characters"
}
```

**錯誤響應** (401 Unauthorized):
- 如果未登錄，會返回認證錯誤

**錯誤響應** (500 Internal Server Error):
```json
{
  "error": "Failed to search foods"
}
```

## 🔍 調試檢查清單

- [ ] 服務器是否正常啟動？
- [ ] `server/routes/food.ts` 文件是否存在？
- [ ] `server/routes.ts` 中是否導入了 `foodRoutes`？
- [ ] `server/routes.ts` 中是否註冊了 `/api/food` 路由？
- [ ] 是否已登錄（認證檢查）？
- [ ] 查詢參數是否正確（至少 2 個字符）？
- [ ] Open Food Facts API 是否可訪問？
- [ ] 控制台是否有錯誤日誌？

## 📊 預期行為

### 正常情況

1. **搜索成功**:
   - 返回食物數組（最多 10 個結果）
   - 每個結果包含完整的營養信息
   - 控制台顯示: `[Open Food Facts API] Found X foods`

2. **無結果**:
   - 返回空數組 `[]`
   - 控制台顯示: `[Open Food Facts API] Found 0 foods`

3. **API 錯誤**:
   - 返回 500 錯誤
   - 控制台顯示錯誤詳情

### 日誌輸出

成功搜索時應該看到：
```
[Open Food Facts API] Searching for: "apple"
[Open Food Facts API] Found 5 foods
```

## 🐛 常見問題

### 問題 1: 404 Not Found

**原因**: 路由未正確註冊

**解決**:
- 檢查 `server/routes.ts` 中是否有 `app.use("/api/food", foodRoutes)`
- 確認導入語句: `import foodRoutes from "./routes/food"`

### 問題 2: 401 Unauthorized

**原因**: 未登錄或 session 過期

**解決**:
- 確保已登錄
- 檢查 session cookie 是否有效

### 問題 3: 空結果

**原因**: 
- Open Food Facts API 無結果
- 產品沒有營養數據

**解決**:
- 嘗試不同的搜索關鍵詞
- 檢查 Open Food Facts API 是否可訪問

### 問題 4: 500 Internal Server Error

**原因**: 
- Open Food Facts API 不可訪問
- 網絡問題
- API 響應格式變化

**解決**:
- 檢查網絡連接
- 查看服務器日誌
- 驗證 Open Food Facts API 狀態

## 📝 下一步

1. **前端集成**: 更新前端代碼以使用新的 `/api/food/search` 端點
2. **錯誤處理**: 添加更詳細的錯誤處理和用戶提示
3. **緩存**: 考慮添加響應緩存以提高性能
4. **備用方案**: 如果 Open Food Facts 失敗，可以回退到 USDA API

## 🔗 相關資源

- [Open Food Facts API 文檔](https://world.openfoodfacts.org/data)
- [Open Food Facts API 搜索參數](https://world.openfoodfacts.org/data)
- 項目中的 USDA API 實現: `server/routes.ts` (line 552)

