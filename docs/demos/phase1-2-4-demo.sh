#!/bin/bash
# ============================================================
# Phase 1+2+4 Demo — Full System Integration
# ============================================================
# This demo exercises:
#   Phase 1: Client library (heartbeat + paste payloads)
#   Phase 2: Server core (API ingestion + SQLite storage)
#   Phase 4: Dashboard (auth + exam list + student detail)
#
# Usage:
#   cd sebMonitoring
#   bash docs/demos/phase1-2-4-demo.sh
#
# Prerequisites:
#   - Deno installed
#   - Port 8000 available
# ============================================================

set -e

PORT=${PORT:-8000}
BASE_URL="http://localhost:$PORT"
DASHBOARD_PASSWORD="demo-password-123"
COOKIE_SECRET="demo-secret-key-at-least-32-chars!!"
DB_PATH="/tmp/seb-monitor-demo-$(date +%s).db"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${BLUE}[DEMO]${NC} $1"; }
ok()   { echo -e "${GREEN}[  OK]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$DB_PATH"
  log "Cleaned up."
}
trap cleanup EXIT

echo ""
echo -e "${YELLOW}============================================================${NC}"
echo -e "${YELLOW}  SEB Monitor — Phase 1+2+4 Integration Demo${NC}"
echo -e "${YELLOW}============================================================${NC}"
echo ""

# ============================================================
# Step 1: Start the real server
# ============================================================
log "Step 1: Starting server on port $PORT..."
DB_PATH="$DB_PATH" \
  DASHBOARD_PASSWORD="$DASHBOARD_PASSWORD" \
  COOKIE_SECRET="$COOKIE_SECRET" \
  deno run --allow-net --allow-env --allow-read --allow-write \
  server/src/main.ts &
SERVER_PID=$!

# Wait for server to be ready
for i in $(seq 1 20); do
  if curl -s "$BASE_URL/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

HEALTH=$(curl -s "$BASE_URL/health")
echo "$HEALTH" | grep -q '"ok"' && ok "Server is healthy: $HEALTH" || fail "Server failed to start"
echo ""

# ============================================================
# Step 2: Send heartbeats from 3 students (Phase 2)
# ============================================================
log "Step 2: Sending heartbeats from 3 students (Phase 2: Server Core)..."

# Student 1 — Alice (focused, typed most of her answer)
ALICE_HB=$(curl -s -X POST "$BASE_URL/api/heartbeat" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "Alice Martin",
    "examId": "CS101-Midterm",
    "questionId": "q1",
    "timestamp": 1718300000000,
    "focus": {"focusedTimeMs": 55000, "unfocusedTimeMs": 5000, "blurCount": 1},
    "input": {"typedChars": 450, "pastedChars": 0, "deletedChars": 30, "currentLength": 420},
    "keys": {"keyDownCount": 1200, "ctrlCount": 2, "altCount": 0, "shiftCount": 45},
    "copyCount": 0,
    "pasteCount": 0,
    "events": [
      {"type": "focus", "timestamp": 1718300001000},
      {"type": "blur", "timestamp": 1718300030000},
      {"type": "focus", "timestamp": 1718300031000}
    ]
  }')
ALICE_SID=$(echo "$ALICE_HB" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
ok "Alice heartbeat → sessionId: $ALICE_SID"

# Student 2 — Bob (suspicious: lots of paste activity, external copies)
BOB_HB=$(curl -s -X POST "$BASE_URL/api/heartbeat" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "Bob Dupont",
    "examId": "CS101-Midterm",
    "questionId": "q1",
    "timestamp": 1718300000000,
    "focus": {"focusedTimeMs": 40000, "unfocusedTimeMs": 20000, "blurCount": 5},
    "input": {"typedChars": 50, "pastedChars": 800, "deletedChars": 10, "currentLength": 840},
    "keys": {"keyDownCount": 100, "ctrlCount": 8, "altCount": 2, "shiftCount": 5},
    "copyCount": 3,
    "pasteCount": 4,
    "events": [
      {"type": "blur", "timestamp": 1718300005000},
      {"type": "focus", "timestamp": 1718300008000},
      {"type": "copy", "timestamp": 1718300010000, "hash": "ext-abc123", "length": 200},
      {"type": "paste", "timestamp": 1718300011000, "hash": "ext-abc123", "length": 200, "matchedCopyHash": "ext-abc123"},
      {"type": "blur", "timestamp": 1718300015000},
      {"type": "focus", "timestamp": 1718300020000},
      {"type": "paste", "timestamp": 1718300025000, "hash": "ext-def456", "length": 300, "matchedCopyHash": null}
    ]
  }')
BOB_SID=$(echo "$BOB_HB" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
ok "Bob heartbeat → sessionId: $BOB_SID"

# Student 3 — Charlie (normal activity, no paste)
CHARLIE_HB=$(curl -s -X POST "$BASE_URL/api/heartbeat" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "Charlie Ng",
    "examId": "CS101-Midterm",
    "questionId": "q1",
    "timestamp": 1718300000000,
    "focus": {"focusedTimeMs": 58000, "unfocusedTimeMs": 2000, "blurCount": 0},
    "input": {"typedChars": 600, "pastedChars": 0, "deletedChars": 45, "currentLength": 555},
    "keys": {"keyDownCount": 1500, "ctrlCount": 1, "altCount": 0, "shiftCount": 60},
    "copyCount": 0,
    "pasteCount": 0,
    "events": [
      {"type": "focus", "timestamp": 1718300001000}
    ]
  }')
CHARLIE_SID=$(echo "$CHARLIE_HB" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
ok "Charlie heartbeat → sessionId: $CHARLIE_SID"
echo ""

# ============================================================
# Step 3: Send paste content (Phase 2)
# ============================================================
log "Step 3: Sending paste content from Bob (Phase 2: Paste Storage)..."

curl -s -X POST "$BASE_URL/api/paste" \
  -H "Content-Type: application/json" \
  -d "{
    \"hash\": \"ext-abc123\",
    \"content\": \"Recursion is a technique where a function calls itself to solve a problem by breaking it into smaller subproblems.\",
    \"length\": 120,
    \"sessionId\": \"$BOB_SID\",
    \"examId\": \"CS101-Midterm\",
    \"timestamp\": 1718300011000
  }" | grep -q '"ok"' && ok "Paste content stored for hash ext-abc123" || fail "Paste storage failed"

curl -s -X POST "$BASE_URL/api/paste" \
  -H "Content-Type: application/json" \
  -d "{
    \"hash\": \"ext-def456\",
    \"content\": \"In computer science, recursion is a method of solving a problem where the solution depends on solutions to smaller instances of the same problem.\",
    \"length\": 155,
    \"sessionId\": \"$BOB_SID\",
    \"examId\": \"CS101-Midterm\",
    \"timestamp\": 1718300025000
  }" | grep -q '"ok"' && ok "Paste content stored for hash ext-def456" || fail "Paste storage failed"
echo ""

# ============================================================
# Step 4: Verify dashboard auth (Phase 4)
# ============================================================
log "Step 4: Testing dashboard authentication (Phase 4)..."

# 4a: Unauthenticated request should redirect
REDIRECT=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/dashboard")
[ "$REDIRECT" = "302" ] && ok "Unauthenticated /dashboard → 302 redirect" || fail "Expected 302, got $REDIRECT"

# 4b: Login page should be accessible
LOGIN_HTML=$(curl -s "$BASE_URL/auth/login")
echo "$LOGIN_HTML" | grep -q "password" && ok "GET /auth/login → login form rendered" || fail "Login form not found"

# 4c: Login with correct password
AUTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -D - -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "password=$DASHBOARD_PASSWORD")
echo "$AUTH_RESPONSE" | grep -q "302" && ok "POST /auth/login with correct password → 302 redirect" || fail "Login failed"
COOKIE=$(echo "$AUTH_RESPONSE" | grep -i "set-cookie" | head -1 | sed 's/.*: //' | cut -d';' -f1)
ok "Auth cookie received: ${COOKIE:0:30}..."
echo ""

# ============================================================
# Step 5: View dashboard pages (Phase 4)
# ============================================================
log "Step 5: Viewing dashboard pages (Phase 4: Dashboard UI)..."

# 5a: Exam list
EXAM_HTML=$(curl -s -b "$COOKIE" "$BASE_URL/dashboard")
echo "$EXAM_HTML" | grep -q "Alice Martin" && ok "Dashboard shows Alice Martin" || fail "Alice not found"
echo "$EXAM_HTML" | grep -q "Bob Dupont" && ok "Dashboard shows Bob Dupont" || fail "Bob not found"
echo "$EXAM_HTML" | grep -q "Charlie Ng" && ok "Dashboard shows Charlie Ng" || fail "Charlie not found"

# 5b: Student detail for Bob (suspicious)
BOB_DETAIL=$(curl -s -b "$COOKIE" "$BASE_URL/dashboard/CS101-Midterm/student/$BOB_SID")
echo "$BOB_DETAIL" | grep -q "Bob Dupont" && ok "Bob detail page renders" || fail "Bob detail failed"
echo "$BOB_DETAIL" | grep -q "Chart" && ok "Chart.js included for timeline" || fail "Chart missing"
echo "$BOB_DETAIL" | grep -q "ext-abc123" && ok "Paste hash visible in events" || fail "Paste hash missing"
echo "$BOB_DETAIL" | grep -q "Recursion is a technique" && ok "Paste content expandable" || fail "Paste content missing"
echo "$BOB_DETAIL" | grep -q "highlight-unmatched" && ok "Unmatched paste highlighted" || fail "Highlight missing"

# 5c: Student detail for Alice (clean)
ALICE_DETAIL=$(curl -s -b "$COOKIE" "$BASE_URL/dashboard/CS101-Midterm/student/$ALICE_SID")
echo "$ALICE_DETAIL" | grep -q "Alice Martin" && ok "Alice detail page renders" || fail "Alice detail failed"
echo ""

# ============================================================
# Step 6: Summary
# ============================================================
echo -e "${YELLOW}============================================================${NC}"
echo -e "${GREEN}  ✅ Demo complete!${NC}"
echo -e "${YELLOW}============================================================${NC}"
echo ""
info "Server is still running on port $PORT"
info "Dashboard:  $BASE_URL/dashboard"
info "Login page: $BASE_URL/auth/login"
info "Password:   $DASHBOARD_PASSWORD"
info "DB file:    $DB_PATH"
echo ""
info "Open these URLs in your browser to see the dashboard!"
echo ""
info "Press Ctrl+C to stop the server and clean up."
echo ""

# Keep server running
wait $SERVER_PID 2>/dev/null || true
