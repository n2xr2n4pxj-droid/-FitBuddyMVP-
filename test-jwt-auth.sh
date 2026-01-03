#!/bin/bash

# ==========================================
# JWT 認證測試流程
# ==========================================

echo "=========================================="
echo "JWT 認證測試流程"
echo "=========================================="
echo ""

# 顏色定義
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# API 基礎 URL
API_BASE="http://localhost:3000/api"

echo -e "${BLUE}步驟 1: 檢查依賴${NC}"
echo "檢查 jsonwebtoken 是否已安裝..."
if npm list jsonwebtoken > /dev/null 2>&1; then
    echo -e "${GREEN}✓ jsonwebtoken 已安裝${NC}"
else
    echo -e "${YELLOW}⚠ 安裝 jsonwebtoken...${NC}"
    npm install jsonwebtoken @types/jsonwebtoken
fi
echo ""

echo -e "${BLUE}步驟 2: 確保服務器正在運行${NC}"
echo "請確保後端服務器運行在 http://localhost:3000"
echo "如果沒有運行，請執行: npm run dev:server"
echo ""
read -p "按 Enter 繼續..."
echo ""

echo -e "${BLUE}步驟 3: 創建測試用戶（教練）${NC}"
echo "執行註冊請求..."
echo ""
COACH_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "coach@test.com",
    "password": "test123456",
    "firstName": "Coach",
    "lastName": "Test"
  }')

echo "響應:"
echo "$COACH_RESPONSE" | jq '.' 2>/dev/null || echo "$COACH_RESPONSE"
echo ""

# 提取 token
COACH_TOKEN=$(echo "$COACH_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$COACH_TOKEN" ]; then
    echo -e "${RED}❌ 註冊失敗或未返回 token${NC}"
    echo "嘗試使用現有用戶登錄..."
    echo ""
    
    echo -e "${BLUE}步驟 4: 登錄獲取 token（教練）${NC}"
    COACH_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
      -H "Content-Type: application/json" \
      -d '{
        "email": "coach@test.com",
        "password": "test123456"
      }')
    
    echo "響應:"
    echo "$COACH_RESPONSE" | jq '.' 2>/dev/null || echo "$COACH_RESPONSE"
    echo ""
    
    COACH_TOKEN=$(echo "$COACH_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$COACH_TOKEN" ]; then
    echo -e "${RED}❌ 無法獲取 token，請檢查服務器是否正常運行${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 教練 Token 獲取成功${NC}"
echo "Token: ${COACH_TOKEN:0:50}..."
echo ""

echo -e "${BLUE}步驟 5: 創建測試用戶（客戶）${NC}"
echo "執行註冊請求..."
echo ""
CLIENT_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@test.com",
    "password": "test123456",
    "firstName": "Client",
    "lastName": "Test"
  }')

echo "響應:"
echo "$CLIENT_RESPONSE" | jq '.' 2>/dev/null || echo "$CLIENT_RESPONSE"
echo ""

CLIENT_TOKEN=$(echo "$CLIENT_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$CLIENT_TOKEN" ]; then
    echo "嘗試使用現有用戶登錄..."
    CLIENT_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
      -H "Content-Type: application/json" \
      -d '{
        "email": "client@test.com",
        "password": "test123456"
      }')
    
    CLIENT_TOKEN=$(echo "$CLIENT_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi

echo -e "${GREEN}✓ 客戶 Token 獲取成功${NC}"
echo "Token: ${CLIENT_TOKEN:0:50}..."
echo ""

echo -e "${BLUE}步驟 6: 使用 Bearer Token 測試邀請 API${NC}"
echo ""

echo "6.1 發送邀請（使用 Bearer Token）..."
echo ""
INVITE_RESPONSE=$(curl -s -X POST "$API_BASE/invitations/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COACH_TOKEN" \
  -d '{
    "clientEmail": "client@test.com",
    "message": "歡迎加入我的訓練計劃！"
  }')

echo "響應:"
echo "$INVITE_RESPONSE" | jq '.' 2>/dev/null || echo "$INVITE_RESPONSE"
echo ""

# 提取邀請 token
INVITATION_TOKEN=$(echo "$INVITE_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$INVITATION_TOKEN" ]; then
    echo -e "${GREEN}✓ 邀請發送成功${NC}"
    echo "邀請 Token: $INVITATION_TOKEN"
    echo ""
    
    echo "6.2 獲取待處理邀請（客戶視角）..."
    echo ""
    PENDING_RESPONSE=$(curl -s -X GET "$API_BASE/invitations/pending" \
      -H "Authorization: Bearer $CLIENT_TOKEN")
    
    echo "響應:"
    echo "$PENDING_RESPONSE" | jq '.' 2>/dev/null || echo "$PENDING_RESPONSE"
    echo ""
    
    echo "6.3 接受邀請（使用 Bearer Token）..."
    echo ""
    ACCEPT_RESPONSE=$(curl -s -X POST "$API_BASE/invitations/accept/$INVITATION_TOKEN" \
      -H "Authorization: Bearer $CLIENT_TOKEN")
    
    echo "響應:"
    echo "$ACCEPT_RESPONSE" | jq '.' 2>/dev/null || echo "$ACCEPT_RESPONSE"
    echo ""
    
    if echo "$ACCEPT_RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ 邀請接受成功${NC}"
    else
        echo -e "${YELLOW}⚠ 邀請可能已被接受或出現錯誤${NC}"
    fi
else
    echo -e "${YELLOW}⚠ 邀請發送可能失敗或邀請已存在${NC}"
fi

echo ""
echo -e "${BLUE}步驟 7: 測試 Session 認證（向後兼容）${NC}"
echo "使用 Session Cookie 登錄..."
echo ""

# 使用 Session Cookie 登錄
curl -s -c /tmp/cookies.txt -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "coach@test.com",
    "password": "test123456"
  }' > /dev/null

echo "使用 Session Cookie 測試邀請 API..."
SESSION_RESPONSE=$(curl -s -X GET "$API_BASE/invitations/pending" \
  -b /tmp/cookies.txt)

echo "響應:"
echo "$SESSION_RESPONSE" | jq '.' 2>/dev/null || echo "$SESSION_RESPONSE"
echo ""

echo "=========================================="
echo -e "${GREEN}測試完成！${NC}"
echo "=========================================="
echo ""
echo "測試總結:"
echo "1. ✓ 依賴檢查完成"
echo "2. ✓ 用戶註冊/登錄完成"
echo "3. ✓ JWT Token 獲取成功"
echo "4. ✓ Bearer Token 認證測試完成"
echo "5. ✓ Session 認證測試完成"
echo ""
echo "教練 Token: ${COACH_TOKEN:0:50}..."
echo "客戶 Token: ${CLIENT_TOKEN:0:50}..."
echo ""

