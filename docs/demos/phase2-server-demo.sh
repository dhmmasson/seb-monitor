#!/bin/bash
# ============================================================
# Phase 2 Demo — Full Server Integration Test
# ============================================================
# This script demonstrates the complete server workflow:
# 1. Start the server
# 2. Send heartbeats from multiple students
# 3. Send paste content
# 4. Verify data is stored correctly
# ============================================================

set -e

PORT=${PORT:-8000}
BASE_URL="http://localhost:$PORT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[DEMO]${NC} $1"; }
ok()  { echo -e "${GREEN}[  OK]${NC} $1"; }
fail(){ echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

# ============================================================
# Step 1: Health check
# ============================================================
log "Step 1: Checking server health..."
HEALTH=$(curl -s "$BASE_URL/health")
echo "$HEALTH" | grep -q '"ok"' && ok "Server is healthy" || fail "Health check failed"

# ============================================================
# Step 2: Send heartbeats from 3 students
# ============================================================
log "Step 2: Sending heartbeats from 3 students..."

# Student 1 — Alice (active, focused)
ALICE_HB=$(curl -s -X POST "$BASE_URL/api/heartbeat" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "alice-001",
    "examId": "midterm-cs101",
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
ok "Alice heartbeat sent → sessionId: $ALICE_SID"

# Student 2 — Bob (suspicious: lots of paste activity)
BOB_HB=$(curl -s -X POST "$BASE_URL/api/heartbeat" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "bob-002",
    "examId": "midterm-cs101",
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
      {"type": "copy", "timestamp": 1718300010000, "hash": "ext-abc", "length": 200},
      {"type": "paste", "timestamp": 1718300011000, "hash": "ext-abc", "length": 200},
      {"type": "blur", "timestamp": 1718300015000},
      {"type": "focus", "timestamp": 1718300020000},
      {"type": "paste", "timestamp": 1718300025000, "hash": "ext-def", "length": 300}
    ]
  }')
BOB_SID=$(echo "$BOB_HB" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
ok "Bob heartbeat sent → sessionId: $BOB_SID"

# Student 3 — Charlie (normal activity)
CHARLIE_HB=$(curl -s -X POST "$BASE_URL/api/heartbeat" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "charlie-003",
    "examId": "midterm-cs101",
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
ok "Charlie heartbeat sent → sessionId: $CHARLIE_SID"

# ============================================================
# Step 3: Send second heartbeat from Alice (simulating time passing)
# ============================================================
log "Step 3: Sending second heartbeat from Alice (60s later)..."
curl -s -X POST "$BASE_URL/api/heartbeat" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"alice-001\",
    \"examId\": \"midterm-cs101\",
    \"questionId\": \"q1\",
    \"timestamp\": 1718300060000,
    \"focus\": {\"focusedTimeMs\": 59000, \"unfocusedTimeMs\": 1000, \"blurCount\": 0},
    \"input\": {\"typedChars\": 200, \"pastedChars\": 0, \"deletedChars\": 15, \"currentLength\": 605},
    \"keys\": {\"keyDownCount\": 500, \"ctrlCount\": 0, \"altCount\": 0, \"shiftCount\": 20},
    \"copyCount\": 0,
    \"pasteCount\": 0,
    \"events\": []
  }" > /dev/null
ok "Alice second heartbeat sent"

# ============================================================
# Step 4: Send paste content (simulating Bob's suspicious paste)
# ============================================================
log "Step 4: Sending paste content from Bob..."
PASTE_RESP=$(curl -s -X POST "$BASE_URL/api/paste" \
  -H "Content-Type: application/json" \
  -d "{
    \"hash\": \"ext-abc\",
    \"content\": \"This is text copied from an external source that Bob pasted into the exam.\",
    \"length\": 78,
    \"sessionId\": \"$BOB_SID\",
    \"examId\": \"midterm-cs101\",
    \"timestamp\": 1718300011000
  }")
echo "$PASTE_RESP" | grep -q '"ok"' && ok "Paste content stored" || fail "Paste storage failed"

# ============================================================
# Step 5: Retrieve and verify paste content
# ============================================================
log "Step 5: Retrieving paste content..."
PASTE_GET=$(curl -s "$BASE_URL/api/paste/ext-abc")
echo "$PASTE_GET" | grep -q "external source" && ok "Paste content retrieved successfully" || fail "Paste retrieval failed"
echo "  Content: $(echo "$PASTE_GET" | grep -o '"content":"[^"]*"' | cut -d'"' -f4)"

# ============================================================
# Step 6: Test idempotency — same paste hash again
# ============================================================
log "Step 6: Testing idempotency (same hash)..."
curl -s -X POST "$BASE_URL/api/paste" \
  -H "Content-Type: application/json" \
  -d "{
    \"hash\": \"ext-abc\",
    \"content\": \"Different content but same hash\",
    \"length\": 33,
    \"sessionId\": \"$BOB_SID\",
    \"examId\": \"midterm-cs101\",
    \"timestamp\": 1718300012000
  }" > /dev/null

# Verify original content is preserved
PASTE_VERIFY=$(curl -s "$BASE_URL/api/paste/ext-abc")
echo "$PASTE_VERIFY" | grep -q "external source" && ok "Idempotent — original content preserved" || fail "Idempotency failed"

# ============================================================
# Step 7: Test 404 for missing paste
# ============================================================
log "Step 7: Testing 404 for missing hash..."
MISSING=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/paste/nonexistent")
HTTP_CODE=$(echo "$MISSING" | tail -1)
[ "$HTTP_CODE" = "404" ] && ok "404 returned for missing hash" || fail "Expected 404, got $HTTP_CODE"

# ============================================================
# Step 8: Test 400 for invalid heartbeat
# ============================================================
log "Step 8: Testing 400 for invalid payload..."
INVALID=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/heartbeat" \
  -H "Content-Type: application/json" \
  -d '{"invalid": "payload"}')
HTTP_CODE=$(echo "$INVALID" | tail -1)
[ "$HTTP_CODE" = "400" ] && ok "400 returned for invalid payload" || fail "Expected 400, got $HTTP_CODE"

# ============================================================
# Summary
# ============================================================
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  Phase 2 Demo Complete — All checks passed!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Data stored:"
echo "  - 3 students (Alice, Bob, Charlie)"
echo "  - 4 heartbeats (Alice×2, Bob×1, Charlie×1)"
echo "  - 10 events (focus, blur, copy, paste)"
echo "  - 1 paste content (Bob's suspicious external paste)"
echo ""
echo "Endpoints tested:"
echo "  - GET  /health            → 200 OK"
echo "  - POST /api/heartbeat     → 200 + sessionId"
echo "  - POST /api/heartbeat     → 400 (invalid payload)"
echo "  - POST /api/paste         → 200 OK"
echo "  - POST /api/paste         → idempotent (same hash)"
echo "  - GET  /api/paste/:hash   → 200 + content"
echo "  - GET  /api/paste/:hash   → 404 (not found)"
echo ""
echo "Run 'deno task test' in server/ to see the full test suite (28 tests)."
