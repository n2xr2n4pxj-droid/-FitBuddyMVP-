# JWT 認證測試流程 - 完整 curl 命令

## 前提條件

1. **確保服務器正在運行**
   ```bash
   # 終端 1: 啟動後端服務器
   npm run dev:server
   
   # 終端 2: 啟動前端服務器（可選）
   npm run dev
   ```

2. **檢查依賴**
   ```bash
   npm list jsonwebtoken
   # 如果沒有安裝，執行：
   npm install jsonwebtoken @types/jsonwebtoken
   ```

---

## 測試步驟

### 步驟 1: 創建測試用戶（教練）

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "coach@test.com",
    "password": "test123456",
    "firstName": "Coach",
    "lastName": "Test"
  }'
```

**預期響應:**
```json
{
  "user": {
    "id": "...",
    "email": "coach@test.com",
    "firstName": "Coach",
    "lastName": "Test"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**保存 Token:**
```bash
# 將響應保存到變量（需要 jq）
COACH_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "coach@test.com",
    "password": "test123456",
    "firstName": "Coach",
    "lastName": "Test"
  }' | jq -r '.token')

echo $COACH_TOKEN
```

---

### 步驟 2: 創建測試用戶（客戶）

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@test.com",
    "password": "test123456",
    "firstName": "Client",
    "lastName": "Test"
  }'
```

**保存 Token:**
```bash
CLIENT_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@test.com",
    "password": "test123456",
    "firstName": "Client",
    "lastName": "Test"
  }' | jq -r '.token')

echo $CLIENT_TOKEN
```

---

### 步驟 3: 如果用戶已存在，使用登錄獲取 Token

**教練登錄:**
```bash
COACH_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "coach@test.com",
    "password": "test123456"
  }' | jq -r '.token')

echo "Coach Token: $COACH_TOKEN"
```

**客戶登錄:**
```bash
CLIENT_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@test.com",
    "password": "test123456"
  }' | jq -r '.token')

echo "Client Token: $CLIENT_TOKEN"
```

---

### 步驟 4: 使用 Bearer Token 發送邀請

```bash
curl -X POST http://localhost:3000/api/invitations/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COACH_TOKEN" \
  -d '{
    "clientEmail": "client@test.com",
    "message": "歡迎加入我的訓練計劃！"
  }'
```

**預期響應:**
```json
{
  "success": true,
  "message": "Invitation sent successfully",
  "invitation": {
    "id": "...",
    "senderId": "...",
    "receiverEmail": "client@test.com",
    "token": "abc123...",
    "status": "PENDING"
  }
}
```

**保存邀請 Token:**
```bash
INVITATION_TOKEN=$(curl -s -X POST http://localhost:3000/api/invitations/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COACH_TOKEN" \
  -d '{
    "clientEmail": "client@test.com",
    "message": "歡迎加入我的訓練計劃！"
  }' | jq -r '.invitation.token')

echo "Invitation Token: $INVITATION_TOKEN"
```

---

### 步驟 5: 使用 Bearer Token 獲取待處理邀請

```bash
curl -X GET http://localhost:3000/api/invitations/pending \
  -H "Authorization: Bearer $CLIENT_TOKEN"
```

**預期響應:**
```json
[
  {
    "id": "...",
    "senderId": "...",
    "receiverEmail": "client@test.com",
    "status": "PENDING",
    "token": "abc123...",
    "message": "歡迎加入我的訓練計劃！"
  }
]
```

---

### 步驟 6: 使用 Bearer Token 接受邀請

```bash
curl -X POST http://localhost:3000/api/invitations/accept/$INVITATION_TOKEN \
  -H "Authorization: Bearer $CLIENT_TOKEN"
```

**預期響應:**
```json
{
  "success": true,
  "message": "Invitation accepted successfully",
  "relationship": {
    "id": "...",
    "coachId": "...",
    "clientId": "...",
    "status": "ACTIVE"
  },
  "invitation": {
    "id": "...",
    "status": "ACCEPTED"
  }
}
```

---

### 步驟 7: 使用 Bearer Token 拒絕邀請（可選）

如果有多個邀請，可以測試拒絕：

```bash
curl -X POST http://localhost:3000/api/invitations/reject/$INVITATION_TOKEN \
  -H "Authorization: Bearer $CLIENT_TOKEN"
```

---

### 步驟 8: 測試 Session 認證（向後兼容）

**使用 Session Cookie 登錄:**
```bash
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "coach@test.com",
    "password": "test123456"
  }'
```

**使用 Session Cookie 測試 API:**
```bash
curl -b cookies.txt -X GET http://localhost:3000/api/invitations/pending
```

---

## 完整測試腳本（一行命令）

```bash
# 設置變量
API_BASE="http://localhost:3000/api"

# 1. 註冊教練並獲取 Token
COACH_TOKEN=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"coach@test.com","password":"test123456","firstName":"Coach","lastName":"Test"}' \
  | jq -r '.token')

# 2. 註冊客戶並獲取 Token
CLIENT_TOKEN=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"client@test.com","password":"test123456","firstName":"Client","lastName":"Test"}' \
  | jq -r '.token')

# 3. 發送邀請
INVITE_RESPONSE=$(curl -s -X POST "$API_BASE/invitations/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COACH_TOKEN" \
  -d '{"clientEmail":"client@test.com","message":"歡迎加入我的訓練計劃！"}')

INVITATION_TOKEN=$(echo "$INVITE_RESPONSE" | jq -r '.invitation.token')

# 4. 獲取待處理邀請
curl -s -X GET "$API_BASE/invitations/pending" \
  -H "Authorization: Bearer $CLIENT_TOKEN" | jq '.'

# 5. 接受邀請
curl -s -X POST "$API_BASE/invitations/accept/$INVITATION_TOKEN" \
  -H "Authorization: Bearer $CLIENT_TOKEN" | jq '.'
```

---

## 錯誤排查

### 如果 Token 為 null

1. **檢查服務器是否運行:**
   ```bash
   curl http://localhost:3000/api/auth/user
   ```

2. **檢查註冊/登錄響應:**
   ```bash
   curl -v -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"coach@test.com","password":"test123456"}'
   ```

3. **檢查 JWT_SECRET 環境變量:**
   ```bash
   # 在 .env 文件中設置
   JWT_SECRET=your-secret-key-here
   ```

### 如果認證失敗

1. **檢查 Token 格式:**
   ```bash
   echo "$COACH_TOKEN" | cut -d'.' -f1 | base64 -d
   ```

2. **測試 Bearer Token:**
   ```bash
   curl -v -X GET http://localhost:3000/api/invitations/pending \
     -H "Authorization: Bearer $COACH_TOKEN"
   ```

---

## 預期結果

✅ 所有 API 請求應該返回 200 或 201 狀態碼  
✅ Bearer Token 認證應該正常工作  
✅ Session 認證應該向後兼容  
✅ 邀請流程應該完整運行

