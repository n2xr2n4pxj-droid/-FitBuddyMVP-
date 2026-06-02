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

DB_HOST=$(node -e "try { const u = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null; console.log(u?.hostname || ''); } catch { console.log(''); }" 2>/dev/null)

if [ -n "${DB_HOST}" ]; then
  echo "[precheck] Checking DB DNS for ${DB_HOST}"
  if ! node -e "require('dns').lookup(process.argv[1], (e)=>process.exit(e?1:0))" "${DB_HOST}" >/dev/null 2>&1; then
    echo "[precheck] DB host is not resolvable: ${DB_HOST}" >&2
    echo "[precheck] Check your network / VPN / DATABASE_URL." >&2
    exit 1
  fi
  echo "[precheck] DB DNS OK."
fi

exit 0
