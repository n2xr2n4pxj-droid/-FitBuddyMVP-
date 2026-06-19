#!/usr/bin/env bash
# =============================================================================
# w3-explain-baseline.sh
# W3 DB Performance — EXPLAIN ANALYZE 基線量測腳本（14 條 proxy 查詢）
#
# 用法：
#   npm run w3:baseline
#   W3_TEST_USER_ID=<uuid> W3_TEST_COACH_ID=<uuid> W3_TEST_LEARNER_ID=<uuid> \
#     npm run w3:baseline
# =============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

command -v psql &>/dev/null || { echo "❌ 需要 psql。請執行：brew install postgresql"; exit 1; }
command -v jq &>/dev/null || { echo "❌ 需要 jq。請執行：brew install jq"; exit 1; }

TEST_USER_ID="${W3_TEST_USER_ID:-}"
TEST_COACH_ID="${W3_TEST_COACH_ID:-}"
TEST_LEARNER_ID="${W3_TEST_LEARNER_ID:-}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --user-id) TEST_USER_ID="$2"; shift 2 ;;
    --coach-id) TEST_COACH_ID="$2"; shift 2 ;;
    --learner-id) TEST_LEARNER_ID="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL 未設定。請先執行："
  echo "   set -a && source server/.env.local && set +a"
  exit 1
fi

if [ -z "$TEST_USER_ID" ]; then
  TEST_USER_ID=$(psql "$DATABASE_URL" -t -A -c \
    "SELECT user_id FROM workout_sessions
     WHERE completed_at IS NOT NULL
     GROUP BY user_id ORDER BY COUNT(*) DESC LIMIT 1;" 2>/dev/null || echo "")
  if [ -z "$TEST_USER_ID" ]; then
    TEST_USER_ID=$(psql "$DATABASE_URL" -t -A -c \
      "SELECT id FROM users ORDER BY created_at LIMIT 1;" 2>/dev/null || echo "")
  fi
  if [ -z "$TEST_USER_ID" ]; then
    echo "❌ 無法取得 test user id。請用 --user-id 或 W3_TEST_USER_ID 指定。"
    exit 1
  fi
  echo "ℹ️  自動選用 test user (most sessions): $TEST_USER_ID"
fi

if [ -z "$TEST_COACH_ID" ]; then
  TEST_COACH_ID=$(psql "$DATABASE_URL" -t -A -c \
    "SELECT coach_id FROM coach_clients
     WHERE status = 'active' LIMIT 1;" 2>/dev/null || echo "")
  [ -z "$TEST_COACH_ID" ] && TEST_COACH_ID="$TEST_USER_ID"
fi

if [ -z "$TEST_LEARNER_ID" ]; then
  TEST_LEARNER_ID=$(psql "$DATABASE_URL" -t -A -c \
    "SELECT client_id FROM coach_clients
     WHERE coach_id = '$TEST_COACH_ID' AND status = 'active' LIMIT 1;" \
    2>/dev/null || echo "")
  [ -z "$TEST_LEARNER_ID" ] && TEST_LEARNER_ID="$TEST_USER_ID"
fi

mkdir -p "$ROOT_DIR/tmp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$ROOT_DIR/tmp/w3-baseline-${TIMESTAMP}.json"
SUMMARY_FILE="$ROOT_DIR/tmp/w3-baseline-${TIMESTAMP}-summary.txt"

echo ""
echo "============================================================"
echo " W3 EXPLAIN ANALYZE Baseline"
echo " User    : $TEST_USER_ID"
echo " Coach   : $TEST_COACH_ID"
echo " Learner : $TEST_LEARNER_ID"
echo " Output  : $OUTPUT_FILE"
echo "============================================================"
echo ""

RESULTS="[]"

run_explain() {
  local label="$1"
  local sql="$2"
  local priority="$3"

  echo -n "  [$priority] $label ... "

  local explain_sql="EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}"
  local raw_result
  raw_result=$(psql "$DATABASE_URL" -t -A -c "$explain_sql" 2>&1 || true)

  if echo "$raw_result" | grep -qE "^ERROR|^psql:" || ! echo "$raw_result" | jq empty 2>/dev/null; then
    echo "❌ FAIL"
    local entry
    entry=$(jq -n \
      --arg label "$label" \
      --arg priority "$priority" \
      --arg error "$raw_result" \
      '{label:$label, priority:$priority, error:$error,
        exec_time_ms:0, actual_rows:0, seq_scan_count:0, plan:null}')
    RESULTS=$(echo "$RESULTS" | jq ". + [$entry]")
    return
  fi

  local exec_time rows node_type has_seq_scan
  exec_time=$(echo "$raw_result" | jq -r '.[0]."Execution Time" // empty' 2>/dev/null || true)
  [[ "$exec_time" =~ ^[0-9.]+$ ]] || exec_time="0"

  rows=$(echo "$raw_result" | jq -r '.[0].Plan."Actual Rows" // empty' 2>/dev/null || true)
  [[ "$rows" =~ ^[0-9]+$ ]] || rows="0"

  node_type=$(echo "$raw_result" | jq -r '.[0].Plan."Node Type" // "N/A"' 2>/dev/null || echo "N/A")

  has_seq_scan=$(echo "$raw_result" | \
    jq '[.. | objects | select(."Node Type" == "Seq Scan")] | length' 2>/dev/null || echo "0")
  [[ "$has_seq_scan" =~ ^[0-9]+$ ]] || has_seq_scan="0"

  if [ "$has_seq_scan" -gt 0 ]; then
    echo "⚠️  Seq Scan (${exec_time}ms, rows=${rows})"
  else
    echo "✅ ${exec_time}ms (rows=${rows}, top=${node_type})"
  fi

  local entry
  entry=$(jq -n \
    --arg label "$label" \
    --arg priority "$priority" \
    --arg node_type "$node_type" \
    --argjson exec_time "$exec_time" \
    --argjson rows "$rows" \
    --argjson seq_scans "$has_seq_scan" \
    --argjson plan "$raw_result" \
    '{label:$label, priority:$priority, node_type:$node_type,
      exec_time_ms:$exec_time, actual_rows:$rows,
      seq_scan_count:$seq_scans, error:null, plan:$plan}')
  RESULTS=$(echo "$RESULTS" | jq ". + [$entry]")
}

echo "── P0 高頻查詢 ──────────────────────────────────────────────"

run_explain "#1 workout-volume sessions (user + date range)" \
  "SELECT ws.id, ws.completed_at, ws.user_id
   FROM workout_sessions ws
   WHERE ws.user_id = '$TEST_USER_ID'
     AND ws.completed_at IS NOT NULL
     AND ws.completed_at >= NOW() - INTERVAL '12 weeks'
   ORDER BY ws.completed_at DESC" \
  "P0"

run_explain "#1b workout-volume correlated subquery (per-session set count)" \
  "SELECT ws.id,
     (SELECT COUNT(*) FROM session_sets ss
      JOIN session_exercises se ON ss.session_exercise_id = se.id
      WHERE se.session_id = ws.id AND ss.completed = true) AS completed_sets
   FROM workout_sessions ws
   WHERE ws.user_id = '$TEST_USER_ID'
     AND ws.completed_at IS NOT NULL
   ORDER BY ws.completed_at DESC
   LIMIT 20" \
  "P0"

run_explain "#1c workout-volume JOIN rewrite proxy (per-session set count, PR-1)" \
  "SELECT ws.id, ws.completed_at,
     COUNT(ss.id) FILTER (WHERE ss.completed = true) AS completed_sets
   FROM workout_sessions ws
   LEFT JOIN session_exercises se ON se.session_id = ws.id
   LEFT JOIN session_sets ss ON ss.session_exercise_id = se.id
   WHERE ws.user_id = '$TEST_USER_ID'
     AND ws.completed_at IS NOT NULL
     AND ws.completed_at >= NOW() - INTERVAL '12 weeks'
   GROUP BY ws.id, ws.completed_at
   ORDER BY ws.completed_at DESC" \
  "P0"

run_explain "#2 workout sessions (my, order by completed_at)" \
  "SELECT ws.id, ws.completed_at, ws.user_id, ws.routine_id
   FROM workout_sessions ws
   WHERE ws.user_id = '$TEST_USER_ID'
   ORDER BY ws.completed_at DESC NULLS LAST
   LIMIT 20" \
  "P0"

run_explain "#3 ReBAC coach_clients (active check)" \
  "SELECT cc.status
   FROM coach_clients cc
   WHERE cc.coach_id = '$TEST_COACH_ID'
     AND cc.client_id = '$TEST_LEARNER_ID'
     AND cc.status = 'active'" \
  "P0"

run_explain "#3b learner sessions (coach view)" \
  "SELECT ws.id, ws.completed_at
   FROM workout_sessions ws
   WHERE ws.user_id = '$TEST_LEARNER_ID'
   ORDER BY ws.completed_at DESC NULLS LAST
   LIMIT 20" \
  "P0"

run_explain "#4 dashboard latest session (LIMIT 1)" \
  "SELECT ws.id, ws.completed_at, ws.routine_id
   FROM workout_sessions ws
   WHERE ws.user_id = '$TEST_USER_ID'
     AND ws.completed_at IS NOT NULL
   ORDER BY ws.completed_at DESC
   LIMIT 1" \
  "P0"

run_explain "#4b dashboard plan_assignments (learner)" \
  "SELECT pa.id, pa.routine_id, pa.assigned_at
   FROM plan_assignments pa
   WHERE pa.learner_id = '$TEST_USER_ID'
   ORDER BY pa.assigned_at DESC
   LIMIT 5" \
  "P0"

run_explain "#5 plan_assignments by learner_id (GET /plans/my)" \
  "SELECT pa.id, pa.routine_id, pa.learner_id, pa.assigned_at
   FROM plan_assignments pa
   WHERE pa.learner_id = '$TEST_USER_ID'
   ORDER BY pa.assigned_at DESC" \
  "P0"

run_explain "#6 workout_routines upcoming (client + scheduled_date + is_completed)" \
  "SELECT wr.id, wr.client_id, wr.scheduled_date
   FROM workout_routines wr
   WHERE wr.client_id = '$TEST_USER_ID'
     AND wr.deleted_at IS NULL
     AND wr.is_completed = false
     AND wr.scheduled_date >= CURRENT_DATE
   ORDER BY wr.scheduled_date ASC
   LIMIT 20" \
  "P0"

echo ""
echo "── P1 教練端查詢 ────────────────────────────────────────────"

run_explain "#7 ReBAC coach_clients (coach+client+status compound)" \
  "SELECT cc.id
   FROM coach_clients cc
   WHERE cc.coach_id = '$TEST_COACH_ID'
     AND cc.client_id = '$TEST_LEARNER_ID'
     AND cc.status = 'active'
   LIMIT 1" \
  "P1"

run_explain "#8 workout_routines by coach_id (plans available)" \
  "SELECT wr.id, wr.coach_id
   FROM workout_routines wr
   WHERE wr.coach_id = '$TEST_COACH_ID'
     AND wr.deleted_at IS NULL" \
  "P1"

run_explain "#9 body_composition_logs (user + date range) [regression baseline]" \
  "SELECT bcl.id, bcl.user_id, bcl.measured_at, bcl.weight
   FROM body_composition_logs bcl
   WHERE bcl.user_id = '$TEST_USER_ID'
     AND bcl.measured_at >= NOW() - INTERVAL '6 months'
   ORDER BY bcl.measured_at ASC" \
  "P1"

run_explain "#10 notifications (user + cursor pagination)" \
  "SELECT n.id, n.user_id, n.sent_at
   FROM notifications n
   WHERE n.user_id = '$TEST_USER_ID'
   ORDER BY n.sent_at DESC
   LIMIT 20" \
  "P1"

echo "$RESULTS" | jq \
  --arg timestamp "$TIMESTAMP" \
  --arg user_id "$TEST_USER_ID" \
  --arg coach_id "$TEST_COACH_ID" \
  --arg learner_id "$TEST_LEARNER_ID" \
  '{
    meta: {
      timestamp: $timestamp,
      test_user_id: $user_id,
      test_coach_id: $coach_id,
      test_learner_id: $learner_id,
      generator: "scripts/w3-explain-baseline.sh"
    },
    queries: .
  }' > "$OUTPUT_FILE"

echo ""
echo "============================================================"
echo " 摘要"
echo "============================================================"

TOTAL=$(jq '.queries | length' "$OUTPUT_FILE")
SEQ_SCAN_COUNT=$(jq '[.queries[] | select(.seq_scan_count > 0)] | length' "$OUTPUT_FILE")
SLOW_COUNT=$(jq '[.queries[] | select(.exec_time_ms > 100)] | length' "$OUTPUT_FILE")
ERROR_COUNT=$(jq '[.queries[] | select(.error != null)] | length' "$OUTPUT_FILE")

{
  echo ""
  echo "  總查詢數       : $TOTAL"
  echo "  Seq Scan       : ${SEQ_SCAN_COUNT} 個（候選加索引）"
  echo "  慢查詢(>100ms) : ${SLOW_COUNT} 個"
  echo "  執行失敗       : ${ERROR_COUNT} 個"
  echo ""
  echo "  ⚠️  需處理："
  jq -r '.queries[] |
    select(.seq_scan_count > 0 or .exec_time_ms > 100 or .error != null) |
    "  - [\(.priority)] \(.label) — \(.exec_time_ms)ms, seq_scans=\(.seq_scan_count)"' \
    "$OUTPUT_FILE"
  echo ""
  echo "  ✅ 正常（index hit, <100ms）："
  jq -r '.queries[] |
    select(.seq_scan_count == 0 and .exec_time_ms <= 100 and .error == null) |
    "  - \(.label) — \(.exec_time_ms)ms"' \
    "$OUTPUT_FILE"
} | tee "$SUMMARY_FILE"

echo ""
echo "============================================================"
echo " JSON  : $OUTPUT_FILE"
echo " 摘要  : $SUMMARY_FILE"
echo "============================================================"
echo ""
