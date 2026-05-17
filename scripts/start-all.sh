#!/usr/bin/env bash
# InsurChain — one-shot startup
# Starts: MySQL (docker), Hardhat node, deploy contracts, seed DB, backend, frontend
# Usage: ./scripts/start-all.sh

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/.logs"
mkdir -p "$LOG_DIR"

# ANSI colors
C_BLUE="\033[1;34m"; C_GREEN="\033[1;32m"; C_YELLOW="\033[1;33m"; C_RED="\033[1;31m"; C_OFF="\033[0m"
log()  { echo -e "${C_BLUE}[start-all]${C_OFF} $*"; }
ok()   { echo -e "${C_GREEN}    ✓${C_OFF} $*"; }
warn() { echo -e "${C_YELLOW}    !${C_OFF} $*"; }
die()  { echo -e "${C_RED}    ✗${C_OFF} $*"; exit 1; }

# ── 1. MySQL via Docker ───────────────────────────────────────────────
log "Starting MySQL (Docker)..."
cd "$ROOT"
docker compose up -d > /dev/null
for i in {1..30}; do
  if docker exec insurance_db mysqladmin ping -h localhost -u root -ppassword --silent 2>/dev/null; then
    ok "MySQL ready"
    break
  fi
  [ $i -eq 30 ] && die "MySQL did not become ready in 90s"
  sleep 3
done

# ── 2. Hardhat node ────────────────────────────────────────────────────
log "Starting Hardhat node on :8545..."
if lsof -i :8545 -t > /dev/null 2>&1 || ss -tln | grep -q ":8545 "; then
  warn "Port 8545 already in use — assuming Hardhat is running"
else
  cd "$ROOT/contracts"
  nohup npx hardhat node > "$LOG_DIR/hardhat.log" 2>&1 &
  echo $! > "$LOG_DIR/hardhat.pid"
  for i in {1..15}; do
    if curl -s -X POST -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' \
      http://127.0.0.1:8545 2>/dev/null | grep -q "0x7a69"; then
      ok "Hardhat node ready (PID $(cat "$LOG_DIR/hardhat.pid"))"
      break
    fi
    [ $i -eq 15 ] && die "Hardhat did not start"
    sleep 1
  done
fi

# ── 3. Deploy contracts ────────────────────────────────────────────────
log "Deploying smart contracts to localhost..."
cd "$ROOT/contracts"
npx hardhat run scripts/deploy.js --network localhost > "$LOG_DIR/deploy.log" 2>&1
POLICY=$(grep "InsurancePolicy deployed" "$LOG_DIR/deploy.log" | awk '{print $NF}')
CLAIMS=$(grep "ClaimsProcessor deployed" "$LOG_DIR/deploy.log" | awk '{print $NF}')
[ -n "$POLICY" ] && [ -n "$CLAIMS" ] || die "Deploy failed — see $LOG_DIR/deploy.log"
ok "Policy:  $POLICY"
ok "Claims:  $CLAIMS"

# Sync .env files (deterministic addresses, but rewrite anyway to be safe)
sed -i \
  -e "s|^CONTRACT_ADDRESS_POLICY=.*|CONTRACT_ADDRESS_POLICY=$POLICY|" \
  -e "s|^CONTRACT_ADDRESS_CLAIMS=.*|CONTRACT_ADDRESS_CLAIMS=$CLAIMS|" \
  "$ROOT/backend/.env"
sed -i \
  -e "s|^REACT_APP_POLICY_CONTRACT=.*|REACT_APP_POLICY_CONTRACT=$POLICY|" \
  -e "s|^REACT_APP_CLAIMS_CONTRACT=.*|REACT_APP_CLAIMS_CONTRACT=$CLAIMS|" \
  "$ROOT/frontend/.env"

# ── 4. Seed demo data ──────────────────────────────────────────────────
log "Seeding demo data..."
docker cp "$ROOT/scripts/seed-demo-data.sql" insurance_db:/tmp/seed.sql > /dev/null
docker exec insurance_db mysql -u root -ppassword insurance_db -e "source /tmp/seed.sql" 2>&1 | grep -v "Warning" | sed 's/^/    /'
ok "Demo data seeded"

# ── 5. Backend ─────────────────────────────────────────────────────────
log "Starting backend on :3001..."
if ss -tln | grep -q ":3001 "; then
  warn "Port 3001 in use — killing existing"
  fuser -k 3001/tcp 2>/dev/null || true
  sleep 1
fi
cd "$ROOT/backend"
nohup node src/app.js > "$LOG_DIR/backend.log" 2>&1 &
echo $! > "$LOG_DIR/backend.pid"
for i in {1..10}; do
  if curl -s http://localhost:3001/api/health 2>/dev/null | grep -q ok; then
    ok "Backend ready (PID $(cat "$LOG_DIR/backend.pid"))"
    break
  fi
  [ $i -eq 10 ] && die "Backend did not start — see $LOG_DIR/backend.log"
  sleep 1
done

# ── 6. Frontend ────────────────────────────────────────────────────────
log "Starting frontend on :3000..."
if ss -tln | grep -q ":3000 "; then
  warn "Port 3000 in use — killing existing"
  fuser -k 3000/tcp 2>/dev/null || true
  sleep 1
fi
cd "$ROOT/frontend"
PORT=3000 BROWSER=none nohup npm start > "$LOG_DIR/frontend.log" 2>&1 &
echo $! > "$LOG_DIR/frontend.pid"
for i in {1..30}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
    ok "Frontend ready (PID $(cat "$LOG_DIR/frontend.pid"))"
    break
  fi
  [ $i -eq 30 ] && warn "Frontend slow to start — check $LOG_DIR/frontend.log"
  sleep 2
done

# ── Summary ────────────────────────────────────────────────────────────
echo ""
echo -e "${C_GREEN}========================================${C_OFF}"
echo -e "${C_GREEN} InsurChain is ready${C_OFF}"
echo -e "${C_GREEN}========================================${C_OFF}"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:3001"
echo "  Hardhat:   http://127.0.0.1:8545  (Chain ID 31337)"
echo "  MySQL:     localhost:3306  (insurance_db)"
echo ""
echo "  Logs:      $LOG_DIR/"
echo "  Stop:      ./scripts/stop-all.sh"
echo ""
echo "  Admin wallet  (10,000 ETH):  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
echo "  Admin privkey (import into MetaMask):"
echo "  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
echo ""
