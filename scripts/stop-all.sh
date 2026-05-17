#!/usr/bin/env bash
# InsurChain — clean shutdown
# Stops: frontend, backend, Hardhat. Optionally stops MySQL.

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/.logs"

stop_pid_file() {
  local f="$1"
  local name="$2"
  if [ -f "$f" ]; then
    local pid; pid=$(cat "$f")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
      echo "    ✓ Stopped $name (PID $pid)"
    fi
    rm -f "$f"
  fi
}

echo "[stop-all] Stopping services..."

stop_pid_file "$LOG_DIR/frontend.pid" "frontend"
stop_pid_file "$LOG_DIR/backend.pid"  "backend"
stop_pid_file "$LOG_DIR/hardhat.pid"  "hardhat"

# Also kill any lingering processes on known ports
for port in 3000 3001 8545; do
  fuser -k "$port"/tcp 2>/dev/null && echo "    ✓ Cleared port $port" || true
done

if [ "$1" = "--all" ]; then
  echo "[stop-all] Stopping MySQL (Docker)..."
  cd "$ROOT"
  docker compose down
  echo "    ✓ MySQL stopped (data preserved in volume)"
fi

echo "[stop-all] Done."
