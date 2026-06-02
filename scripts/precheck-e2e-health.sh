#!/usr/bin/env bash
set -euo pipefail

TEST_BASE_URL="${TEST_BASE_URL:-http://127.0.0.1:3000}"
HEALTH_URL="${TEST_BASE_URL%/}/health"

echo "[precheck] Checking API health at ${HEALTH_URL}"

if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
  echo "[precheck] API is reachable."
else
  echo "[precheck] API is not reachable: ${HEALTH_URL}" >&2
  echo "[precheck] Please start backend first (example: npm run dev:backend)." >&2
  exit 1
fi

# 自動載入環境檔（優先 .env.local，再 .env），避免每次手動 source
if [ -z "${DATABASE_URL:-}" ]; then
  for ENV_FILE in "server/.env.local" ".env.local" ".env"; do
    if [ -f "${ENV_FILE}" ]; then
      echo "[precheck] Loading ${ENV_FILE}"
      set -a
      # shellcheck disable=SC1090
      source "${ENV_FILE}"
      set +a
      break
    fi
  done
fi

# DATABASE_URL 必填
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[precheck] DATABASE_URL is not set." >&2
  echo "[precheck] Please set DATABASE_URL (via .env.local/.env or exported env)." >&2
  exit 1
fi

# DB DNS 必須可解析
DB_HOST=$(node -e "try { const u = new URL(process.env.DATABASE_URL); console.log(u.hostname); } catch { console.log(''); }" 2>/dev/null)

if [ -z "${DB_HOST}" ]; then
  echo "[precheck] Could not parse DB hostname from DATABASE_URL." >&2
  exit 1
fi

echo "[precheck] Checking DB DNS for ${DB_HOST}"
if ! node -e "require('dns').lookup(process.argv[1], (e)=>process.exit(e?1:0))" "${DB_HOST}" >/dev/null 2>&1; then
  echo "[precheck] DB host is not resolvable: ${DB_HOST}" >&2
  echo "[precheck] Check your network / VPN / DATABASE_URL." >&2
  exit 1
fi

echo "[precheck] DB DNS OK."

exit 0
