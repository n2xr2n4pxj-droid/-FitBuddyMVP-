#!/usr/bin/env bash
# FitBuddy Phase 7.2 — API Version Governance 驗收腳本（PR-1 靜態 gate）
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

header "validate:7.2 — API Version Governance"

echo -e "\n${BOLD}[ V1a — /api/v1/invitations 路由掛載存在 ]${NC}"
if "$RG_BIN" 'app\.use\("/api/v1/invitations"' server/routes.ts --quiet 2>/dev/null; then
  pass "V1a: /api/v1/invitations 掛載存在"
else
  fail "V1a: /api/v1/invitations 掛載存在"
fi

echo -e "\n${BOLD}[ V1b — /api/invitations legacy 仍存在（相容期）]${NC}"
if "$RG_BIN" '^\s*"/api/invitations"' server/routes.ts --quiet 2>/dev/null; then
  pass "V1b: /api/invitations legacy 掛載仍存在（相容期）"
else
  fail "V1b: /api/invitations legacy 掛載仍存在（相容期）"
fi

echo -e "\n${BOLD}[ V2a — deprecationMiddleware 檔案存在 ]${NC}"
if [[ -f "server/middleware/deprecation.ts" ]]; then
  pass "V2a: deprecationMiddleware 檔案存在"
else
  fail "V2a: deprecationMiddleware 檔案存在"
fi

echo -e "\n${BOLD}[ V2c — legacy invitations 掛載有 deprecationMiddleware ]${NC}"
if "$RG_BIN" 'deprecationMiddleware\(.*/api/v1/invitations' server/routes.ts --quiet 2>/dev/null; then
  pass "V2c: /api/invitations legacy 已接 deprecationMiddleware"
else
  fail "V2c: /api/invitations legacy 已接 deprecationMiddleware"
fi

echo -e "\n${BOLD}[ V2b — client/src 不得新增 /api/invitations 直連 ]${NC}"
LEGACY_CLIENT="$("$RG_BIN" "/api/invitations" client/src --glob '*.{ts,tsx}' 2>/dev/null | "$RG_BIN" -v "v1" || true)"
if [[ -z "$LEGACY_CLIENT" ]]; then
  pass "V2b: client/src 無 /api/invitations 直連（非 v1）"
else
  echo -e "     ↳ 發現以下直連（需改為 /api/v1/invitations）："
  echo "$LEGACY_CLIENT" | sed 's/^/       /'
  fail "V2b: client/src 無 /api/invitations 直連（非 v1）"
fi

echo -e "\n${BOLD}[ V3a — check-verification 筆誤已修 ]${NC}"
OLD_ENDPOINT="$("$RG_BIN" "check-verification" client/src --glob '*.{ts,tsx}' 2>/dev/null || true)"
if [[ -z "$OLD_ENDPOINT" ]]; then
  pass "V3a: client/src 無 check-verification 舊端點引用"
else
  echo -e "     ↳ 仍有舊引用（需改為 check-email-verified）："
  echo "$OLD_ENDPOINT" | sed 's/^/       /'
  fail "V3a: client/src 無 check-verification 舊端點引用"
fi

echo -e "\n${BOLD}[ V3c — legacy verify-email 掛載已接 deprecationMiddleware ]${NC}"
if "$RG_BIN" 'deprecationMiddleware.*verify-email' server/routes/auth.ts --quiet 2>/dev/null; then
  pass "V3c: legacy /api/auth/verify-email 掛載已接 deprecationMiddleware"
else
  fail "V3c: legacy /api/auth/verify-email 掛載已接 deprecationMiddleware"
fi

echo -e "\n${BOLD}[ V3b — validate:7.4 回歸守門 ]${NC}"
if [[ "${VALIDATE_72_SKIP_74:-0}" = "1" ]]; then
  warn "V3b: validate:7.4 已跳過（VALIDATE_72_SKIP_74=1）"
else
  echo "  [V3b] 呼叫 validate:7.4 回歸守門..."
  if npm run validate:7.4 --silent 2>/dev/null; then
    pass "V3b: validate:7.4 回歸全綠"
  else
    fail "V3b: validate:7.4 回歸全綠"
  fi
fi

header "最終結果"

echo -e "  ${GREEN}✅ PASS${NC}: ${PASS_COUNT}"
echo -e "  ${RED}❌ FAIL${NC}: ${FAIL_COUNT}"
echo -e "  ${YELLOW}⚠️  WARN${NC}: ${WARN_COUNT}"
echo

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi

echo -e "${GREEN}${BOLD}🎉 Phase 7.2 靜態檢查通過！${NC}"
