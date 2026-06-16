#!/bin/bash
# ============================================================
# Production Demo — Build + Server + Browser
# ============================================================
# This demo:
#   1. Builds the client library (client/dist/seb-monitor.js)
#   2. Starts the real server with auth configured
#   3. Opens the exam page (production-like) in the browser
#   4. Opens the dashboard in the browser
#
# Usage:
#   cd sebMonitoring
#   bash docs/demos/demo.sh
# ============================================================

set -e

PORT=${PORT:-8000}
BASE_URL="http://localhost:$PORT"
DASHBOARD_PASSWORD="demo"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${BLUE}[DEMO]${NC} $1"; }
ok()  { echo -e "${GREEN}[  OK]${NC} $1"; }

echo ""
echo -e "${YELLOW}============================================================${NC}"
echo -e "${YELLOW}  SEB Monitor — Production Demo${NC}"
echo -e "${YELLOW}============================================================${NC}"
echo ""

# ============================================================
# Step 1: Build the client library
# ============================================================
log "Step 1: Building client library..."
cd "$(dirname "$0")/../.."  # Go to project root
deno run -A client/build.ts
ok "Built client/dist/seb-monitor.js"

# ============================================================
# Step 2: Kill any existing server on the port
# ============================================================
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
sleep 0.5

# ============================================================
# Step 3: Start the server
# ============================================================
log "Step 2: Starting server on port $PORT..."
DASHBOARD_PASSWORD="$DASHBOARD_PASSWORD" \
  deno run --allow-net --allow-env --allow-read --allow-write \
  server/src/main.ts &
SERVER_PID=$!

# Wait for server
for i in $(seq 1 20); do
  if curl -s "$BASE_URL/health" >/dev/null 2>&1; then break; fi
  sleep 0.5
done

curl -s "$BASE_URL/health" | grep -q '"ok"' && ok "Server is healthy" || { echo "Server failed"; kill $SERVER_PID 2>/dev/null; exit 1; }

# ============================================================
# Step 4: Open pages
# ============================================================
log "Step 3: Opening pages..."
open "$BASE_URL/exam.html"
ok "Opened exam page"
open "$BASE_URL/auth/login"
ok "Opened dashboard login"

echo ""
echo -e "${YELLOW}============================================================${NC}"
echo -e "${GREEN}  ✅ Demo is running!${NC}"
echo -e "${YELLOW}============================================================${NC}"
echo ""
echo -e "  Exam page:   ${BLUE}$BASE_URL/exam.html${NC}"
echo -e "  Dashboard:   ${BLUE}$BASE_URL/dashboard${NC}"
echo -e "  Login pass:  ${BLUE}$DASHBOARD_PASSWORD${NC}"
echo -e "  Client JS:   ${BLUE}$BASE_URL/seb-monitor.js${NC}"
echo ""
echo -e "  1. Type in the exam textarea"
echo -e "  2. Copy/paste from another source"
echo -e "  3. Wait for heartbeat (or check the console)"
echo -e "  4. Login to dashboard to see your activity"
echo ""
echo -e "  Press Ctrl+C to stop."
echo ""

# Keep server running
wait $SERVER_PID 2>/dev/null || true
