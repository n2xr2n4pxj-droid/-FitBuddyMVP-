# 邀請 API 手動測試指南

## 前置條件

1. 確保後端服務器正在運行：
   ```bash
   npm run dev:server
   ```

2. 確保數據庫連接正常

## 測試步驟

### 步驟 1: 註冊教練用戶

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "coach@example.com",
    "password": "CoachPassword123!",
    "firstName": "教練",
    "lastName": "測試"
  }'
```

### 步驟 2: 登入獲取 JWT Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "coach@example.com",
    "password": "CoachPassword123!"
  }'
```

**響應示例：**
```json
{
  "user": {
    "id": "...",
    "email": "coach@example.com",
    "role": "client"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**複製 `token` 值供後續使用**

### 步驟 3: 更新用戶角色為教練（如果需要）

如果註冊後角色不是 `coach`，需要更新：

```bash
curl -X POST http://localhost:3000/api/auth/role-select \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "coach"
  }'
```

### 步驟 4: 發送邀請

```bash
curl -X POST http://localhost:3000/api/v1/invitations/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_email": "client@example.com",
    "client_name": "John Doe",
    "notes": "加入我的健身計劃"
  }'
```

**響應示例：**
```json
{
  "id": "invitation-id",
  "invitation_code": "abc123def456...",
  "expires_at": "2024-01-15T10:00:00.000Z",
  "created_at": "2024-01-01T10:00:00.000Z",
  "message": "邀請已發送成功"
}
```

**複製 `invitation_code` 值供後續使用**

### 步驟 5: 檢查邀請狀態

```bash
curl http://localhost:3000/api/v1/invitations/status/abc123def456
```

**響應示例：**
```json
{
  "id": "invitation-id",
  "status": "pending",
  "client_email": "client@example.com",
  "client_name": "John Doe",
  "coach_id": "coach-id"
}
```

### 步驟 6: 接受邀請

```bash
curl -X POST http://localhost:3000/api/v1/invitations/accept/abc123def456 \
  -H "Content-Type: application/json" \
  -d '{
    "password": "SecurePassword123!",
    "phone": "+852 1234 5678",
    "agree_terms": true
  }'
```

**響應示例：**
```json
{
  "user_id": "new-user-id",
  "email": "client@example.com",
  "username": "client",
  "role": "client",
  "message": "賬戶創建成功！"
}
```

### 步驟 7: 驗證客戶可以登入

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@example.com",
    "password": "SecurePassword123!"
  }'
```

## 其他有用的 API

### 查看教練的邀請列表

```bash
curl http://localhost:3000/api/v1/invitations/coach/list \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 按狀態過濾邀請

```bash
curl "http://localhost:3000/api/v1/invitations/coach/list?status=PENDING" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 撤銷邀請

```bash
curl -X DELETE http://localhost:3000/api/v1/invitations/invitation-id \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 錯誤處理

### 常見錯誤

1. **401 Unauthorized**
   - 檢查 JWT Token 是否有效
   - 確認 Token 格式正確：`Bearer YOUR_TOKEN`

2. **403 Forbidden**
   - 確認用戶角色是 `coach`
   - 使用 `/api/auth/role-select` 更新角色

3. **400 Bad Request**
   - 檢查請求體格式是否正確
   - 確認必填字段都已提供
   - 檢查郵箱格式是否有效

4. **邀請已過期**
   - 邀請默認 30 天過期
   - 需要重新發送邀請

## 使用 jq 美化輸出

如果安裝了 `jq`，可以在 curl 命令後添加 `| jq '.'`：

```bash
curl http://localhost:3000/api/v1/invitations/status/abc123def456 | jq '.'
```

