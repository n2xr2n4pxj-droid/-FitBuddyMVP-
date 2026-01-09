#!/bin/bash

# FitBuddy 邀請 API 測試腳本
# 測試完整的邀請流程：註冊教練 -> 登入 -> 發送邀請 -> 檢查狀態 -> 接受邀請

API_BASE="${API_BASE:-http://localhost:3000}"
COACH_EMAIL="${COACH_EMAIL:-coach_test_$(date +%s)@example.com}"
COACH_PASSWORD="${COACH_PASSWORD:-TestCoachPassword123!}"
CLIENT_EMAIL="${CLIENT_EMAIL:-client_test_$(date +%s)@example.com}"
CLIENT_NAME="${CLIENT_NAME:-測試客戶}"
CLIENT_PASSWORD="${CLIENT_PASSWORD:-TestClientPassword123!}"

echo "=========================================="
echo "FitBuddy 邀請 API 測試"
echo "=========================================="
echo ""

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 檢查服務器是否運行
echo -e "${YELLOW}1. 檢查服務器狀態...${NC}"
if ! curl -s "$API_BASE/api/auth/user" > /dev/null 2>&1; then
    echo -e "${RED}❌ 服務器未運行！請先啟動服務器：${NC}"
    echo "   npm run dev:server"
    exit 1
fi
echo -e "${GREEN}✅ 服務器運行中${NC}"
echo ""

# 步驟 1: 註冊教練用戶
echo -e "${YELLOW}2. 註冊教練用戶...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$COACH_EMAIL\",
    \"password\": \"$COACH_PASSWORD\",
    \"firstName\": \"教練\",
    \"lastName\": \"測試\"
  }")

echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"

# 檢查註冊是否成功
if echo "$REGISTER_RESPONSE" | grep -q "error"; then
    echo -e "${RED}❌ 註冊失敗（可能用戶已存在，繼續測試登入）${NC}"
else
    echo -e "${GREEN}✅ 教練註冊成功${NC}"
fi
echo ""

# 步驟 2: 登入獲取 JWT Token
echo -e "${YELLOW}3. 登入獲取 JWT Token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$COACH_EMAIL\",
    \"password\": \"$COACH_PASSWORD\"
  }" \
  -c cookies.txt)

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token' 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo -e "${RED}❌ 登入失敗${NC}"
    echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ 登入成功${NC}"
echo "Token: ${TOKEN:0:50}..."
echo ""

# 步驟 3: 更新用戶角色為教練（如果需要）
echo -e "${YELLOW}4. 檢查並更新用戶角色為教練...${NC}"
USER_INFO=$(curl -s "$API_BASE/api/auth/user" -b cookies.txt)
USER_ROLE=$(echo "$USER_INFO" | jq -r '.role' 2>/dev/null)

if [ "$USER_ROLE" != "coach" ] && [ "$USER_ROLE" != "COACH" ]; then
    echo "當前角色: $USER_ROLE，更新為 coach..."
    ROLE_UPDATE=$(curl -s -X POST "$API_BASE/api/auth/role-select" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -b cookies.txt \
      -d '{"role": "coach"}')
    
    echo "$ROLE_UPDATE" | jq '.' 2>/dev/null || echo "$ROLE_UPDATE"
    echo -e "${GREEN}✅ 角色已更新為 coach${NC}"
else
    echo -e "${GREEN}✅ 用戶已經是教練角色${NC}"
fi
echo ""

# 步驟 4: 發送邀請
echo -e "${YELLOW}5. 發送邀請給客戶...${NC}"
INVITE_RESPONSE=$(curl -s -X POST "$API_BASE/api/v1/invitations/send" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_email\": \"$CLIENT_EMAIL\",
    \"client_name\": \"$CLIENT_NAME\",
    \"notes\": \"歡迎加入我的健身計劃！\"
  }")

echo "$INVITE_RESPONSE" | jq '.' 2>/dev/null || echo "$INVITE_RESPONSE"

# 提取邀請碼
INVITATION_CODE=$(echo "$INVITE_RESPONSE" | jq -r '.invitation_code' 2>/dev/null)

if [ -z "$INVITATION_CODE" ] || [ "$INVITATION_CODE" = "null" ]; then
    echo -e "${RED}❌ 發送邀請失敗${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 邀請發送成功${NC}"
echo "邀請碼: $INVITATION_CODE"
echo ""

# 步驟 5: 檢查邀請狀態
echo -e "${YELLOW}6. 檢查邀請狀態...${NC}"
STATUS_RESPONSE=$(curl -s "$API_BASE/api/v1/invitations/status/$INVITATION_CODE")

echo "$STATUS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATUS_RESPONSE"

if echo "$STATUS_RESPONSE" | grep -q "error"; then
    echo -e "${RED}❌ 檢查邀請狀態失敗${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 邀請狀態查詢成功${NC}"
echo ""

# 步驟 6: 接受邀請
echo -e "${YELLOW}7. 接受邀請並創建客戶賬戶...${NC}"
ACCEPT_RESPONSE=$(curl -s -X POST "$API_BASE/api/v1/invitations/accept/$INVITATION_CODE" \
  -H "Content-Type: application/json" \
  -d "{
    \"password\": \"$CLIENT_PASSWORD\",
    \"phone\": \"+852 1234 5678\",
    \"agree_terms\": true
  }")

echo "$ACCEPT_RESPONSE" | jq '.' 2>/dev/null || echo "$ACCEPT_RESPONSE"

if echo "$ACCEPT_RESPONSE" | grep -q "error"; then
    echo -e "${RED}❌ 接受邀請失敗${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 邀請接受成功，客戶賬戶已創建${NC}"
echo ""

# 步驟 7: 驗證客戶可以登入
echo -e "${YELLOW}8. 驗證客戶可以登入...${NC}"
CLIENT_LOGIN=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$CLIENT_EMAIL\",
    \"password\": \"$CLIENT_PASSWORD\"
  }")

CLIENT_TOKEN=$(echo "$CLIENT_LOGIN" | jq -r '.token' 2>/dev/null)

if [ -z "$CLIENT_TOKEN" ] || [ "$CLIENT_TOKEN" = "null" ]; then
    echo -e "${RED}❌ 客戶登入失敗${NC}"
    echo "$CLIENT_LOGIN" | jq '.' 2>/dev/null || echo "$CLIENT_LOGIN"
else
    echo -e "${GREEN}✅ 客戶登入成功${NC}"
    echo "客戶 Token: ${CLIENT_TOKEN:0:50}..."
fi
echo ""

# 清理
rm -f cookies.txt

echo "=========================================="
echo -e "${GREEN}✅ 所有測試完成！${NC}"
echo "=========================================="
echo ""
echo "測試摘要："
echo "  教練郵箱: $COACH_EMAIL"
echo "  客戶郵箱: $CLIENT_EMAIL"
echo "  邀請碼: $INVITATION_CODE"
echo ""

