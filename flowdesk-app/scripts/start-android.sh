#!/data/data/com.termux/files/usr/bin/bash
# Start FlowDesk server + Cloudflare tunnel in one command.
# Prints the stable public URL (https://*.trycloudflare.com) on startup.
#
# Usage:   ./scripts/start-android.sh
# Stop:    Ctrl-C in the running terminal (or kill the two PIDs printed on start).

set -euo pipefail

APP_DIR="$HOME/FlowDesk/flowdesk-app"
cd "$APP_DIR"

# ---------- 1. Wake lock ----------
if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock
fi

# ---------- 2. Start Next.js ----------
echo "==> starting Next.js on port 3000 …"
pnpm start &
SERVER_PID=$!

# Wait briefly for the server to be ready before starting the tunnel
sleep 3

# ---------- 3. Start Cloudflare tunnel ----------
if command -v cloudflared >/dev/null 2>&1; then
  echo "==> starting Cloudflare tunnel …"
  cloudflared tunnel --url http://localhost:3000 &
  TUNNEL_PID=$!
else
  echo "!!  cloudflared not found — install with: pkg install cloudflared"
  echo "    LAN access only: http://$(ip -4 addr show wlan0 2>/dev/null | grep -oP 'inet \K[0-9.]+'):3000"
  TUNNEL_PID=""
fi

# ---------- 4. Print status ----------
LAN_IP=$(ip -4 addr show wlan0 2>/dev/null | grep -oP 'inet \K[0-9.]+' || echo "unknown")
echo ""
echo "=============================================="
echo "  FlowDesk running"
echo "  LAN:    http://${LAN_IP}:3000"
echo "  Public: check the cloudflared URL above ↑"
echo "=============================================="
echo "  PIDs:   server=${SERVER_PID}  tunnel=${TUNNEL_PID}"
echo "  Stop:   kill ${SERVER_PID} ${TUNNEL_PID}"
echo "=============================================="

# ---------- 5. Wait for both ----------
wait
