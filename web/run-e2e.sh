#!/bin/bash
# Start SSH tunnel to Supabase DB via VPS, then run Playwright E2E tests
# Usage: ./run-e2e.sh [playwright options]

TUNNEL_PORT=15432
VPS="root@139.162.42.158"
SSH_KEY="$HOME/.ssh/digitalocean"

# Start tunnel if not already running
if ! lsof -i TCP:$TUNNEL_PORT &>/dev/null; then
  echo "[tunnel] Starting SSH tunnel on localhost:$TUNNEL_PORT..."
  ssh -i "$SSH_KEY" -L ${TUNNEL_PORT}:db.yratipheadkbytqywvtm.supabase.co:5432 "$VPS" -N -f
  sleep 2
  echo "[tunnel] Ready"
else
  echo "[tunnel] Already running on port $TUNNEL_PORT"
fi

E2E_EMAIL="e2e-test@fce-quiz.local" \
E2E_PASSWORD="e2e-test-2026" \
  node node_modules/.bin/playwright test "$@"
