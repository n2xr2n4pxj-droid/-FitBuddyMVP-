#!/usr/bin/env bash
set -euo pipefail

TEST_BASE_URL="${TEST_BASE_URL:-http://127.0.0.1:3000}"
HEALTH_URL="${TEST_BASE_URL%/}/health"

echo "[precheck] Checking API health at ${HEALTH_URL}"

if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
  echo "[precheck] API is reachable."
  exit 0
fi

echo "[precheck] API is not reachable: ${HEALTH_URL}" >&2
echo "[precheck] Please start backend first (example: npm run dev:backend)." >&2
exit 1
