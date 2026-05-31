#!/usr/bin/env bash
# FitBuddy Phase 7.4 — Security Hardening 驗收腳本（第一波）
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RG_BIN="$(command -v rg || true)"
if [[ -z "$RG_BIN" ]]; then
  echo "❌ 找不到 rg（ripgrep），請先安裝：brew install ripgrep"
  exit 127
fi

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

pass() { PASS_COUNT=$((PASS_COUNT + 1)); echo -e "${GREEN}✅ PASS${NC}: $1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); echo -e "${RED}❌ FAIL${NC}: $1"; }
warn() { WARN_COUNT=$((WARN_COUNT + 1)); echo -e "${YELLOW}⚠️  WARN${NC}: $1"; }

header() {
  echo
  echo -e "${BOLD}══════════════════════════════════════════${NC}"
  echo -e "${BOLD} $1${NC}"
  echo -e "${BOLD}══════════════════════════════════════════${NC}"
}

header "S1 — Rate Limiter 覆蓋檢查"

echo -e "\n${BOLD}[ S1a — 關鍵 auth 端點逐一確認有 limiter（同一行比對，排除註解行）]${NC}"
S1A_FAIL=0

check_endpoint_limiter() {
  local endpoint="$1" limiter="$2"
  local matched
  matched="$("$RG_BIN" -n "$endpoint" server/routes.ts 2>/dev/null \
    | "$RG_BIN" -v '^\s*//' \
    | "$RG_BIN" "$limiter" || true)"
  if [[ -n "$matched" ]]; then
    echo -e "  ${GREEN}✅${NC} $endpoint → $limiter"
  else
    echo -e "  ${RED}❌${NC} $endpoint 缺少 $limiter（或被註解）"
    S1A_FAIL=1
  fi
}

check_endpoint_limiter '/api/auth/login' 'loginLimiter'
check_endpoint_limiter '/api/auth/register' 'registerLimiter'
check_endpoint_limiter '/api/auth/forgot-password' 'registerLimiter'

if [[ "$S1A_FAIL" -eq 0 ]]; then
  pass "S1a 三個關鍵 auth 端點皆有 limiter（同一行，非註解）"
else
  fail "S1a 部分 auth 端點缺少 limiter"
fi

echo -e "\n${BOLD}[ S1b — AI 端點有 aiLimiter ]${NC}"
if "$RG_BIN" -q --pcre2 'router\.post\(\s*"/ai/(generate-routine|workout-insight)"\s*,[^)]*aiLimiter' server/routes/ai.ts 2>/dev/null; then
  pass "S1b AI 端點已掛 aiLimiter"
else
  fail "S1b AI 端點缺少 aiLimiter"
fi

echo -e "\n${BOLD}[ S1c — invitations/send 有 invitationLimiter ]${NC}"
if "$RG_BIN" -q "/send.*invitationLimiter|invitationLimiter.*'/send'" server/routes/invitations.ts 2>/dev/null; then
  pass "S1c invitations/send 已掛 invitationLimiter"
else
  fail "S1c invitations/send 缺少 invitationLimiter"
fi

echo -e "\n${BOLD}[ S1d — generalLimiter 尚未掛載（Phase 7.4 P1 待辦）]${NC}"
S1D_OUT="$("$RG_BIN" -n --pcre2 \
  'app\.use\([^)]*generalLimiter|router\.use\([^)]*generalLimiter|router\.(get|post|put|patch|delete)\([^)]*generalLimiter' \
  server/routes.ts server/index.ts server/routes/*.ts 2>/dev/null || true)"
if [[ -n "$S1D_OUT" ]]; then
  warn "S1d generalLimiter 已掛載，請確認是有意為之"
  echo "$S1D_OUT"
else
  pass "S1d generalLimiter 尚未掛載（符合第一波計劃）"
fi

header "S2 — 敏感資料 Redaction 檢查"

echo -e "\n${BOLD}[ S2a — 不得 log req.headers.authorization ]${NC}"
S2A="$("$RG_BIN" -n --pcre2 'console\.(log|info|debug).*\breq\.headers\.authorization\b' \
  server --glob '*.ts' --glob '!*.test.*' 2>/dev/null || true)"
if [[ -z "$S2A" ]]; then
  pass "S2a 未發現 authorization header log"
else
  fail "S2a 發現 authorization header log"
  echo "$S2A"
fi

echo -e "\n${BOLD}[ S2b — API response 不得出現 passwordHash ]${NC}"
S2B="$("$RG_BIN" -n --pcre2 'res\.(json|send)\s*\(.*passwordHash' \
  server/routes --glob '*.ts' --glob '!*.test.*' 2>/dev/null || true)"
if [[ -z "$S2B" ]]; then
  pass "S2b 未發現 passwordHash response 洩漏"
else
  fail "S2b 發現 passwordHash response 洩漏"
  echo "$S2B"
fi

header "S3 — JWT 最小硬化檢查"

echo -e "\n${BOLD}[ S3a — Access Token 預設過期時間 ≤ 60m ]${NC}"
EXP_DEFAULT="$("$RG_BIN" -n --pcre2 \
  "accessTokenExpiration\\s*:\\s*getEnv\\(\\s*['\"]ACCESS_TOKEN_EXPIRATION['\"]\\s*,\\s*['\"]([^'\"]+)['\"]\\s*\\)" \
  server/config/env.ts 2>/dev/null \
  | sed -E "s/.*getEnv\\([\"']ACCESS_TOKEN_EXPIRATION[\"'],[[:space:]]*[\"']([^\"']+)[\"']\\).*/\\1/" \
  | tail -1 || true)"
EXP_DEFAULT="${EXP_DEFAULT:-unknown}"
echo "  → 偵測到預設值：'${EXP_DEFAULT}'"
case "$EXP_DEFAULT" in
  15m|30m|60m|1h) pass "S3a accessTokenExpiration = ${EXP_DEFAULT}（≤ 60m）" ;;
  *)              fail "S3a accessTokenExpiration = ${EXP_DEFAULT}（應 ≤ 60m）" ;;
esac

echo -e "\n${BOLD}[ S3b — Refresh Token 有獨立 secret ]${NC}"
if "$RG_BIN" -q "REFRESH_TOKEN_SECRET|refreshSecret" server/routes/auth.ts server/config/env.ts 2>/dev/null; then
  pass "S3b Refresh Token 使用獨立 secret"
else
  fail "S3b Refresh Token 未使用獨立 secret"
fi

echo -e "\n${BOLD}[ S3c — 提醒檢查 RATE_LIMIT_ENABLED ]${NC}"
if [[ "${RATE_LIMIT_ENABLED:-}" == "false" ]]; then
  warn "S3c RATE_LIMIT_ENABLED=false（本輪不會觸發 429）"
else
  pass "S3c RATE_LIMIT_ENABLED 未關閉"
fi

header "S5 — 安全標頭與 CORS 收斂（P1）"

echo -e "\n${BOLD}[ S5a — Helmet 安全標頭已掛載 ]${NC}"
if "$RG_BIN" -q 'helmet\(' server/index.ts 2>/dev/null; then
  pass "S5a helmet() 已掛載"
else
  fail "S5a server/index.ts 缺少 helmet()"
fi

if "$RG_BIN" -q 'frameguard:\s*\{\s*action:\s*"deny"\s*\}' server/index.ts 2>/dev/null; then
  pass "S5a frameguard=deny 已設定"
else
  fail "S5a 缺少 frameguard=deny"
fi

if "$RG_BIN" -q 'referrerPolicy:\s*\{\s*policy:\s*"no-referrer"\s*\}' server/index.ts 2>/dev/null; then
  pass "S5a referrerPolicy=no-referrer 已設定"
else
  fail "S5a 缺少 referrerPolicy=no-referrer"
fi

if "$RG_BIN" -q -U --pcre2 'contentSecurityPolicy:\s*isProduction\s*\?\s*\{(?s).*?directives\s*:' server/index.ts 2>/dev/null; then
  pass "S5a CSP production 模式已設定 directives"
elif "$RG_BIN" -q 'contentSecurityPolicy:\s*false' server/index.ts 2>/dev/null; then
  warn "S5a CSP 寫死關閉（建議改為 env-aware）"
else
  fail "S5a 未找到 contentSecurityPolicy 設定"
fi

echo -e "\n${BOLD}[ S5b — CORS 白名單化 ]${NC}"
if "$RG_BIN" -q -U --pcre2 "origins\\s*:\\s*getEnv\\([^)]*\\)(?s).*?\\.split\\(\\s*['\\\"]\\s*,\\s*['\\\"]\\s*\\)" server/config/env.ts 2>/dev/null; then
  pass "S5b CORS 支援逗號分隔多來源"
else
  fail "S5b CORS 未支援逗號分隔多來源"
fi

if "$RG_BIN" -q -U --pcre2 "includes\\s*\\(\\s*['\\\"]\\*['\\\"]\\s*\\)" server/config/env.ts 2>/dev/null; then
  pass "S5b production 禁用 * 驗證已加入"
else
  fail "S5b 缺少 production 禁用 * 的驗證邏輯"
fi

if "$RG_BIN" -q 'CORS_ORIGIN_DENIED' server/index.ts 2>/dev/null; then
  pass "S5b 非法來源回 403 guard 已加入"
else
  fail "S5b 缺少非法來源 403 guard"
fi

header "S6 — 輸入邊界檢查（P1）"

echo -e "\n${BOLD}[ S6a — AI 端點有 prompt/payload 長度限制 ]${NC}"
S6A_PROMPT="$("$RG_BIN" -n -U --pcre2 \
  'if\s*\(\s*trimmed\.length\s*>\s*[0-9_]+\s*\)\s*\{\s*return\s+sendError\(' \
  server/routes/ai.ts 2>/dev/null || true)"
S6A_PAYLOAD="$("$RG_BIN" -n -U --pcre2 \
  'if\s*\(\s*payloadSize\s*>\s*[0-9_]+\s*\)\s*\{\s*return\s+sendError\(' \
  server/routes/ai.ts 2>/dev/null || true)"

if [[ -n "$S6A_PROMPT" && -n "$S6A_PAYLOAD" ]]; then
  pass "S6a AI 端點有 prompt/payload 長度限制"
else
  fail "S6a AI 端點缺少 prompt 或 payload 長度限制"
  [[ -z "$S6A_PROMPT" ]] && echo "  → 缺少 prompt 長度限制"
  [[ -z "$S6A_PAYLOAD" ]] && echo "  → 缺少 payload 大小限制"
fi

echo -e "\n${BOLD}[ S6b — body parser 有全域 payload limit ]${NC}"

S6B_JSON="$("$RG_BIN" -n -U --pcre2 \
  '(?i)express\.json\(\s*\{(?s).*?limit\s*:\s*["'"'"'"]100kb["'"'"'"]' \
  server/index.ts 2>/dev/null || true)"
S6B_URLENC="$("$RG_BIN" -n -U --pcre2 \
  '(?i)express\.urlencoded\(\s*\{(?s).*?limit\s*:\s*["'"'"'"]100kb["'"'"'"]' \
  server/index.ts 2>/dev/null || true)"

JSON_CALL_COUNT="$("$RG_BIN" -n 'express\.json\(' server/index.ts 2>/dev/null | wc -l | tr -d ' ')"
URLENC_CALL_COUNT="$("$RG_BIN" -n 'express\.urlencoded\(' server/index.ts 2>/dev/null | wc -l | tr -d ' ')"

if [[ -n "$S6B_JSON" && -n "$S6B_URLENC" && "$JSON_CALL_COUNT" -eq 1 && "$URLENC_CALL_COUNT" -eq 1 ]]; then
  pass "S6b express.json / express.urlencoded 皆有全域 limit=100kb，且各只宣告一次"
else
  fail "S6b body parser limit 檢查未通過（缺 limit 或重複宣告）"
  [[ -z "$S6B_JSON" ]] && echo "  → 缺少 express.json limit=100kb"
  [[ -z "$S6B_URLENC" ]] && echo "  → 缺少 express.urlencoded limit=100kb"
  [[ "$JSON_CALL_COUNT" -ne 1 ]] && echo "  → express.json( 出現 ${JSON_CALL_COUNT} 次（應為 1）"
  [[ "$URLENC_CALL_COUNT" -ne 1 ]] && echo "  → express.urlencoded( 出現 ${URLENC_CALL_COUNT} 次（應為 1）"
fi

header "S7 — 安全事件最小監控（P1）"

echo -e "\n${BOLD}[ S7a — security logger 檔案存在且可匯出 ]${NC}"
if [[ -f "server/lib/securityLogger.ts" ]] && "$RG_BIN" -q 'export function emitSecurityEvent' server/lib/securityLogger.ts 2>/dev/null; then
  pass "S7a securityLogger 已建立且包含 emitSecurityEvent"
else
  fail "S7a 缺少 securityLogger 或 emitSecurityEvent 匯出"
fi

echo -e "\n${BOLD}[ S7b — 全域收斂 401/403/429/5xx ]${NC}"
S7B_STATUS="$("$RG_BIN" -n -U --pcre2 'status\s*===\s*401(?s).*status\s*===\s*403(?s).*status\s*===\s*429(?s).*status\s*>=\s*500' server/index.ts 2>/dev/null || true)"
S7B_EMIT="$("$RG_BIN" -n 'emitSecurityEvent\(' server/index.ts 2>/dev/null || true)"
if [[ -n "$S7B_STATUS" && -n "$S7B_EMIT" ]]; then
  pass "S7b 已在 index.ts 收斂並發送安全事件"
else
  fail "S7b index.ts 缺少 401/403/429/5xx 收斂或 emitSecurityEvent 呼叫"
fi

echo -e "\n${BOLD}[ S7c — sendError 提供 errorCode/logId metadata ]${NC}"
S7C_META="$("$RG_BIN" -n -U --pcre2 'res\.locals\.securityMeta(?s).*errorCode(?s).*logId' server/lib/response.ts 2>/dev/null || true)"
if [[ -n "$S7C_META" ]]; then
  pass "S7c sendError 已提供安全事件 metadata"
else
  fail "S7c sendError 缺少 securityMeta(errorCode/logId)"
fi

echo -e "\n${BOLD}[ S7d — 安全事件欄位無敏感資料 ]${NC}"
S7D_SENSITIVE="$("$RG_BIN" -n --pcre2 'authorization|password|cookie|refreshToken' server/lib/securityLogger.ts 2>/dev/null || true)"
if [[ -z "$S7D_SENSITIVE" ]]; then
  pass "S7d securityLogger 未發現敏感欄位"
else
  fail "S7d securityLogger 含敏感欄位關鍵字"
  echo "$S7D_SENSITIVE"
fi

header "最終結果"
echo
echo -e "  ${GREEN}✅ PASS${NC}: ${PASS_COUNT}"
echo -e "  ${RED}❌ FAIL${NC}: ${FAIL_COUNT}"
echo -e "  ${YELLOW}⚠️  WARN${NC}: ${WARN_COUNT}"
echo

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  echo -e "${RED}${BOLD}🚫 Phase 7.4 第一波尚未通過，請先修復 FAIL。${NC}"
  exit 1
elif [[ "$WARN_COUNT" -gt 0 ]]; then
  echo -e "${YELLOW}${BOLD}⚠️  有 WARN 需人工確認。${NC}"
  exit 0
else
  echo -e "${GREEN}${BOLD}🎉 Phase 7.4 第一波檢查全部通過！${NC}"
  exit 0
fi
