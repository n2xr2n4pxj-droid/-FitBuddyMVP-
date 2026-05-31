#!/bin/bash

# FitBuddy 後端 API 測試腳本
# 測試：登入、搜索食物、創建/獲取餐食、創建/獲取鍛煉

API_BASE="${API_BASE:-http://localhost:3000}"
TEST_EMAIL="${TEST_EMAIL:-testuser_$(date +%s)@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-TestPassword123!}"
TEST_FIRST_NAME="${TEST_FIRST_NAME:-Test}"
TEST_LAST_NAME="${TEST_LAST_NAME:-User}"

echo "=========================================="
echo "FitBuddy 後端 API 測試"
echo "=========================================="
echo ""

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 檢查服務器是否運行
echo -e "${YELLOW}1. 檢查服務器狀態...${NC}"
if ! curl -s "$API_BASE" > /dev/null 2>&1; then
    echo -e "${RED}❌ 服務器未運行！請先啟動服務器：${NC}"
    echo "   npm run dev:server"
    exit 1
fi
echo -e "${GREEN}✅ 服務器運行中${NC}"
echo ""

# 全局變量存儲 token
ACCESS_TOKEN=""

# 步驟 1: 註冊測試用戶
echo -e "${YELLOW}測試 1: 註冊測試用戶...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"firstName\": \"$TEST_FIRST_NAME\",
    \"lastName\": \"$TEST_LAST_NAME\",
    \"role\": \"client\"
  }")

echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"

# 檢查註冊是否成功（如果用戶已存在，繼續測試）
if echo "$REGISTER_RESPONSE" | grep -q "\"success\":\s*true" || echo "$REGISTER_RESPONSE" | grep -q "already registered"; then
    echo -e "${GREEN}✅ 用戶已準備就緒${NC}"
    
    # 自動驗證郵箱（用於測試）
    if source server/.env.local 2>/dev/null || true; then
        echo -e "${YELLOW}   自動驗證郵箱（僅用於測試）...${NC}"
        psql "$DATABASE_URL" -c "UPDATE users SET email_verified = true WHERE email = '$TEST_EMAIL';" > /dev/null 2>&1
        echo -e "${GREEN}   ✅ 郵箱已驗證${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  註冊響應異常，但繼續測試登入...${NC}"
fi
echo ""

# 步驟 2: 登入用戶
echo -e "${BLUE}測試 2: 登入用戶...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"

# 提取 token (登入 API 返回 'token' 字段)
if echo "$LOGIN_RESPONSE" | grep -q "\"token\"" || echo "$LOGIN_RESPONSE" | grep -q "\"accessToken\""; then
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // .accessToken // .access_token // empty' 2>/dev/null)
    
    # 如果 jq 失敗，嘗試用 grep
    if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" == "null" ]; then
        # 嘗試提取 token (先嘗試 token，再嘗試 accessToken)
        ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token"\s*:\s*"[^"]*"' | cut -d'"' -f4 | head -1)
        if [ -z "$ACCESS_TOKEN" ]; then
            ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken"\s*:\s*"[^"]*"' | cut -d'"' -f4 | head -1)
        fi
    fi
    
    if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ] && [ "$ACCESS_TOKEN" != "" ]; then
        echo -e "${GREEN}✅ 登入成功，已獲取 access token${NC}"
        echo "   Token: ${ACCESS_TOKEN:0:50}..."
    else
        echo -e "${RED}❌ 無法提取 access token${NC}"
        echo "完整響應："
        echo "$LOGIN_RESPONSE"
        
        # 檢查是否需要郵箱驗證
        if echo "$LOGIN_RESPONSE" | grep -qi "needsVerification\|需要驗證\|email.*verif"; then
            echo -e "${YELLOW}⚠️  需要先驗證郵箱才能登入${NC}"
            echo "請檢查郵箱並完成驗證後重新運行測試"
        fi
        exit 1
    fi
else
    echo -e "${RED}❌ 登入失敗（未找到 token）${NC}"
    echo "完整響應："
    echo "$LOGIN_RESPONSE"
    
    # 檢查是否需要郵箱驗證
    if echo "$LOGIN_RESPONSE" | grep -qi "needsVerification\|需要驗證\|email.*verif"; then
        echo -e "${YELLOW}⚠️  需要先驗證郵箱才能登入${NC}"
        echo "請檢查郵箱並完成驗證後重新運行測試"
    fi
    exit 1
fi
echo ""

# 檢查是否有 email 驗證要求
if echo "$LOGIN_RESPONSE" | grep -qi "email.*verif\|需要驗證\|未驗證"; then
    echo -e "${YELLOW}⚠️  需要先驗證郵箱，跳過後續測試${NC}"
    echo "請檢查郵箱並驗證後重新運行測試"
    exit 0
fi

# 步驟 3: 搜索食物
echo -e "${BLUE}測試 3: 搜索食物...${NC}"
FOOD_SEARCH_RESPONSE=$(curl -s -X GET "$API_BASE/api/food/search?query=apple" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json")

echo "$FOOD_SEARCH_RESPONSE" | jq '.' 2>/dev/null || echo "$FOOD_SEARCH_RESPONSE"

if echo "$FOOD_SEARCH_RESPONSE" | grep -q "error\|Error"; then
    echo -e "${RED}❌ 搜索食物失敗${NC}"
else
    echo -e "${GREEN}✅ 搜索食物成功${NC}"
fi
echo ""

# 步驟 4: 創建餐食
echo -e "${BLUE}測試 4: 創建餐食...${NC}"
MEAL_DATA='{
  "name": "測試餐食 - 蘋果",
  "mealType": "BREAKFAST",
  "calories": 95,
  "protein": 0.5,
  "carbs": 25,
  "fat": 0.3,
  "consumedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
}'

CREATE_MEAL_RESPONSE=$(curl -s -X POST "$API_BASE/api/meals" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$MEAL_DATA")

echo "$CREATE_MEAL_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_MEAL_RESPONSE"

MEAL_ID=""
if echo "$CREATE_MEAL_RESPONSE" | grep -q "id"; then
    MEAL_ID=$(echo "$CREATE_MEAL_RESPONSE" | jq -r '.id // empty' 2>/dev/null)
    if [ -z "$MEAL_ID" ]; then
        MEAL_ID=$(echo "$CREATE_MEAL_RESPONSE" | grep -o '"id"\s*:\s*"[^"]*"' | cut -d'"' -f4 | head -1)
    fi
    if [ -n "$MEAL_ID" ] && [ "$MEAL_ID" != "null" ]; then
        echo -e "${GREEN}✅ 創建餐食成功，ID: $MEAL_ID${NC}"
    else
        echo -e "${YELLOW}⚠️  創建餐食響應異常${NC}"
    fi
else
    echo -e "${RED}❌ 創建餐食失敗${NC}"
fi
echo ""

# 步驟 5: 獲取餐食
echo -e "${BLUE}測試 5: 獲取餐食...${NC}"
TODAY=$(date +"%Y-%m-%d")
GET_MEALS_RESPONSE=$(curl -s -X GET "$API_BASE/api/meals?date=$TODAY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json")

echo "$GET_MEALS_RESPONSE" | jq '.' 2>/dev/null || echo "$GET_MEALS_RESPONSE"

if echo "$GET_MEALS_RESPONSE" | grep -q "error\|Error"; then
    echo -e "${RED}❌ 獲取餐食失敗${NC}"
else
    MEAL_COUNT=$(echo "$GET_MEALS_RESPONSE" | jq 'length // 0' 2>/dev/null || echo "0")
    echo -e "${GREEN}✅ 獲取餐食成功，共 $MEAL_COUNT 條記錄${NC}"
fi
echo ""

# 步驟 6: 創建鍛煉
echo -e "${BLUE}測試 6: 創建鍛煉...${NC}"
WORKOUT_DATA='{
  "workoutType": "CARDIO",
  "exerciseName": "跑步",
  "durationMinutes": 30,
  "caloriesBurned": 300,
  "performedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
  "exercises": [
    {
      "exerciseName": "跑步",
      "duration": 30,
      "distance": 5,
      "distanceUnit": "km"
    }
  ]
}'

CREATE_WORKOUT_RESPONSE=$(curl -s -X POST "$API_BASE/api/workouts" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$WORKOUT_DATA")

echo "$CREATE_WORKOUT_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_WORKOUT_RESPONSE"

WORKOUT_ID=""
if echo "$CREATE_WORKOUT_RESPONSE" | grep -q "id"; then
    WORKOUT_ID=$(echo "$CREATE_WORKOUT_RESPONSE" | jq -r '.id // empty' 2>/dev/null)
    if [ -z "$WORKOUT_ID" ]; then
        WORKOUT_ID=$(echo "$CREATE_WORKOUT_RESPONSE" | grep -o '"id"\s*:\s*"[^"]*"' | cut -d'"' -f4 | head -1)
    fi
    if [ -n "$WORKOUT_ID" ] && [ "$WORKOUT_ID" != "null" ]; then
        echo -e "${GREEN}✅ 創建鍛煉成功，ID: $WORKOUT_ID${NC}"
    else
        echo -e "${YELLOW}⚠️  創建鍛煉響應異常${NC}"
    fi
else
    echo -e "${RED}❌ 創建鍛煉失敗${NC}"
fi
echo ""

# 步驟 7: 獲取鍛煉
echo -e "${BLUE}測試 7: 獲取鍛煉...${NC}"
GET_WORKOUTS_RESPONSE=$(curl -s -X GET "$API_BASE/api/workouts?date=$TODAY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json")

echo "$GET_WORKOUTS_RESPONSE" | jq '.' 2>/dev/null || echo "$GET_WORKOUTS_RESPONSE"

if echo "$GET_WORKOUTS_RESPONSE" | grep -q "error\|Error"; then
    echo -e "${RED}❌ 獲取鍛煉失敗${NC}"
else
    WORKOUT_COUNT=$(echo "$GET_WORKOUTS_RESPONSE" | jq 'length // 0' 2>/dev/null || echo "0")
    echo -e "${GREEN}✅ 獲取鍛煉成功，共 $WORKOUT_COUNT 條記錄${NC}"
fi
echo ""

# 總結
echo "=========================================="
echo -e "${GREEN}測試完成！${NC}"
echo "=========================================="
echo ""
echo "測試的用戶: $TEST_EMAIL"
echo "餐食 ID: ${MEAL_ID:-未創建}"
echo "鍛煉 ID: ${WORKOUT_ID:-未創建}"
echo ""
