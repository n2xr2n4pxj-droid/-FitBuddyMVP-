# 教練系統 API 實現檢查清單

## ✅ 1. 教練 API 完全實現

### 端點列表
- ✅ **POST** `/api/coaches/add-client` - 添加學生（通過郵箱）
  - 權限驗證：✅ `isAuthenticated`
  - 角色驗證：✅ 檢查用戶是否存在
  - 業務邏輯：✅ 檢查是否已添加、不能添加自己
  - HTTP 狀態碼：✅ 401, 400, 404, 500

- ✅ **GET** `/api/coaches/clients` - 獲取教練的學生列表
  - 權限驗證：✅ `isAuthenticated`
  - 角色驗證：✅ 必須是 `coach` 角色
  - HTTP 狀態碼：✅ 401, 403, 500

- ✅ **GET** `/api/coaches/clients/:clientId` - 獲取特定學生詳情
  - 權限驗證：✅ `isAuthenticated`
  - 關係驗證：✅ 檢查教練-客戶關係
  - HTTP 狀態碼：✅ 401, 403, 500

- ✅ **POST** `/api/coaches/remove-client` - 移除學生
  - 權限驗證：✅ `isAuthenticated`
  - 關係驗證：✅ 檢查教練-客戶關係
  - HTTP 狀態碼：✅ 401, 400, 404, 500

- ✅ **PUT** `/api/coaches/clients/:clientId` - 更新學生狀態
  - 權限驗證：✅ `isAuthenticated`
  - 狀態驗證：✅ 驗證狀態值（'active', 'paused', 'completed'）
  - HTTP 狀態碼：✅ 401, 400, 404, 500

## ✅ 2. 訓練計劃 API 完全實現（CRUD + 狀態管理）

### 端點列表
- ✅ **POST** `/api/workout-plans` - 創建訓練計劃
  - 權限驗證：✅ `isAuthenticated`
  - 角色驗證：✅ 必須是 `coach` 角色
  - 關係驗證：✅ 檢查教練-客戶關係
  - 字段驗證：✅ 驗證必要字段（name, exercises, weekDays, duration）
  - JSON 序列化：✅ `exercises` 和 `weekDays` 使用 `JSON.stringify`
  - HTTP 狀態碼：✅ 401, 403, 400, 500

- ✅ **GET** `/api/workout-plans/client/:clientId` - 獲取學生的訓練計劃
  - 權限驗證：✅ `isAuthenticated`
  - 權限驗證：✅ 是教練或是學生本人
  - JSON 反序列化：✅ `exercises` 和 `weekDays` 使用 `JSON.parse`（含錯誤處理）
  - HTTP 狀態碼：✅ 401, 403, 500

- ✅ **GET** `/api/workout-plans/:id` - 獲取單個訓練計劃
  - 權限驗證：✅ `isAuthenticated`
  - 權限驗證：✅ 是教練或是學生本人
  - JSON 反序列化：✅ `exercises` 和 `weekDays` 使用 `JSON.parse`（含錯誤處理）
  - HTTP 狀態碼：✅ 401, 404, 403, 500

- ✅ **PUT** `/api/workout-plans/:id` - 更新訓練計劃
  - 權限驗證：✅ `isAuthenticated`
  - 角色驗證：✅ 只有教練能編輯
  - JSON 序列化：✅ `exercises` 和 `weekDays` 使用 `JSON.stringify`
  - JSON 反序列化：✅ 返回時使用 `JSON.parse`（含錯誤處理）
  - HTTP 狀態碼：✅ 401, 404, 403, 500

- ✅ **DELETE** `/api/workout-plans/:id` - 刪除訓練計劃
  - 權限驗證：✅ `isAuthenticated`
  - 角色驗證：✅ 只有教練能刪除
  - HTTP 狀態碼：✅ 401, 404, 403, 500

- ✅ **PUT** `/api/workout-plans/:id/status` - 更新計劃狀態
  - 權限驗證：✅ `isAuthenticated`
  - 角色驗證：✅ 只有教練能更新狀態
  - 狀態驗證：✅ 驗證狀態值（'draft', 'active', 'completed'）
  - HTTP 狀態碼：✅ 401, 400, 404, 403, 500

## ✅ 3. 角色選擇 API 實現

### 端點列表
- ✅ **POST** `/api/auth/role-select` - 角色選擇
  - 權限驗證：✅ `isAuthenticated`
  - 角色驗證：✅ 驗證角色值（'client' 或 'coach'）
  - HTTP 狀態碼：✅ 401, 400, 500

- ✅ **GET** `/api/auth/me` - 獲取當前用戶信息
  - 權限驗證：✅ `isAuthenticated`
  - 安全處理：✅ 移除敏感信息（passwordHash）
  - HTTP 狀態碼：✅ 401, 404, 500

## ✅ 4. 所有端點都有權限驗證（RBAC）

### 認證層級
- ✅ 所有端點都使用 `isAuthenticated` 中間件
- ✅ 用戶 ID 提取：兼容 `req.user?.claims?.sub` 和 `req.user?.id`

### 角色驗證
- ✅ 教練端點：驗證用戶角色必須是 `coach`
  - `GET /api/coaches/clients`
  - `POST /api/workout-plans`
  - `PUT /api/workout-plans/:id`
  - `DELETE /api/workout-plans/:id`
  - `PUT /api/workout-plans/:id/status`

### 關係驗證
- ✅ 教練-客戶關係驗證：
  - 添加學生前檢查關係是否存在
  - 查看/更新/刪除前檢查關係是否存在
  - 創建訓練計劃前檢查關係是否存在

### 資源所有權驗證
- ✅ 訓練計劃：只有創建者（教練）可以更新/刪除
- ✅ 訓練計劃查看：教練或學生本人可以查看

## ✅ 5. 所有 JSON 字段正確序列化

### 序列化（寫入數據庫）
- ✅ `exercises` 字段：使用 `JSON.stringify(exercises)`
- ✅ `weekDays` 字段：使用 `JSON.stringify(weekDays)`
- ✅ 位置：
  - `POST /api/workout-plans` - 創建時
  - `PUT /api/workout-plans/:id` - 更新時

### 反序列化（從數據庫讀取）
- ✅ `exercises` 字段：使用 `JSON.parse(p.exercises)`（含錯誤處理）
- ✅ `weekDays` 字段：使用 `JSON.parse(p.weekDays)`（含錯誤處理）
- ✅ 錯誤處理：使用 try-catch 防止無效 JSON 導致服務器崩潰
- ✅ 位置：
  - `GET /api/workout-plans/client/:clientId` - 列表查詢
  - `GET /api/workout-plans/:id` - 單個查詢
  - `PUT /api/workout-plans/:id` - 更新後返回

## ✅ 6. 所有錯誤都有適當的 HTTP 狀態碼

### HTTP 狀態碼使用
- ✅ **401 Unauthorized**：未認證或認證失敗
- ✅ **403 Forbidden**：已認證但無權限（角色不匹配、關係不存在）
- ✅ **400 Bad Request**：請求參數錯誤（缺少字段、無效值）
- ✅ **404 Not Found**：資源不存在（用戶、計劃、關係）
- ✅ **500 Internal Server Error**：服務器內部錯誤（數據庫錯誤、JSON 解析錯誤）

### 錯誤響應格式
- ✅ 所有錯誤都返回 JSON 格式：`{ error: "錯誤訊息" }`
- ✅ 成功響應包含 `success: true` 標記

## ✅ 7. 準備好進行前端開發

### 路由註冊
- ✅ 所有路由已在 `server/routes.ts` 中註冊
- ✅ 路由順序正確（auth 路由優先）

### 數據庫 Schema
- ✅ `coachClients` 表已定義
- ✅ `workoutPlans` 表已定義
- ✅ `users` 表的 `role` 欄位已更新為 `text` 類型

### API 端點總結
總共 **13 個 API 端點**：
- 教練 API：5 個端點
- 訓練計劃 API：6 個端點
- 角色選擇 API：2 個端點

### 前端開發準備
- ✅ 所有端點都有清晰的錯誤訊息
- ✅ 所有端點都返回一致的 JSON 格式
- ✅ 所有端點都有適當的 HTTP 狀態碼
- ✅ JSON 字段正確序列化/反序列化
- ✅ 權限驗證完整

## 📝 注意事項

1. **JSON 解析錯誤處理**：已添加 try-catch 防止無效 JSON 導致服務器崩潰
2. **用戶 ID 提取**：兼容兩種格式（`req.user?.claims?.sub` 和 `req.user?.id`）
3. **敏感信息過濾**：`GET /api/auth/me` 移除 `passwordHash`
4. **狀態驗證**：所有狀態字段都有嚴格的枚舉驗證

## 🎉 結論

所有要求已完全實現，系統已準備好進行前端開發！

