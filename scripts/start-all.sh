#!/usr/bin/env bash
# InsurChain v2 — one-shot startup
# Starts: MySQL (docker) → Hardhat node → deploy 4 contracts → seed DB → backend → oracle daemon → frontend
# Usage: ./scripts/start-all.sh

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/.logs"
mkdir -p "$LOG_DIR"

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

# ── 3. Deploy contracts (4 contracts: Policy, Hospital, Oracle, Claims) ──
# Hardhat default signers (deterministic):
#   #0 admin            0xf39Fd6...    privkey 0xac0974be...
#   #1 admin signer B   0x709979...    privkey 0x59c6995e...
#   #2 admin signer C   0x3c44cd...    privkey 0x5de4111a...
#   #3 customer         0x90F79b...
#   #4 hospital wallet  0x15d34a...    privkey 0x47e179ec...
#   #5 oracle node      0x9965507...   privkey 0x8b3a350c...
log "Deploying 4 smart contracts..."
cd "$ROOT/contracts"
ORACLE_NODE_ADDRESS="0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc" \
  HOSPITAL_WALLET="0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" \
  HOSPITAL_NAME="Demo Hospital" \
  APPROVAL_THRESHOLD=2 \
  SEED_ETH=2 \
  npx hardhat run scripts/deploy.js --network localhost > "$LOG_DIR/deploy.log" 2>&1

POLICY=$(grep "InsurancePolicy deployed" "$LOG_DIR/deploy.log" | awk '{print $NF}')
HOSPITAL=$(grep "HospitalRegistry deployed" "$LOG_DIR/deploy.log" | awk '{print $3}')
ORACLE=$(grep "MockOracle deployed" "$LOG_DIR/deploy.log" | awk '{print $3}')
CLAIMS=$(grep "ClaimsProcessor deployed" "$LOG_DIR/deploy.log" | awk '{print $NF}')

[ -n "$POLICY" ] && [ -n "$CLAIMS" ] && [ -n "$ORACLE" ] && [ -n "$HOSPITAL" ] \
  || die "Deploy failed — see $LOG_DIR/deploy.log"

ok "Policy:    $POLICY"
ok "Hospital:  $HOSPITAL"
ok "Oracle:    $ORACLE"
ok "Claims:    $CLAIMS"

# Helper to upsert a key=value pair into a .env file (works for both Linux sed).
upsert_env() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

# Bootstrap .env files if missing.
[ -f "$ROOT/backend/.env" ]  || cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
[ -f "$ROOT/frontend/.env" ] || cp "$ROOT/frontend/.env.example" "$ROOT/frontend/.env"

# Update backend/.env
upsert_env "$ROOT/backend/.env" CONTRACT_ADDRESS_POLICY   "$POLICY"
upsert_env "$ROOT/backend/.env" CONTRACT_ADDRESS_CLAIMS   "$CLAIMS"
upsert_env "$ROOT/backend/.env" CONTRACT_ADDRESS_ORACLE   "$ORACLE"
upsert_env "$ROOT/backend/.env" CONTRACT_ADDRESS_HOSPITAL "$HOSPITAL"
upsert_env "$ROOT/backend/.env" ADMIN_WALLET              "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
upsert_env "$ROOT/backend/.env" PRIVATE_KEY               "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
upsert_env "$ROOT/backend/.env" PRIVATE_KEY_SIGNER_B      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
upsert_env "$ROOT/backend/.env" ORACLE_NODE_PRIVATE_KEY   "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"
upsert_env "$ROOT/backend/.env" HOSPITAL_API_BASE         "http://localhost:3002/api/hospital"

# Update frontend/.env
upsert_env "$ROOT/frontend/.env" REACT_APP_POLICY_CONTRACT   "$POLICY"
upsert_env "$ROOT/frontend/.env" REACT_APP_CLAIMS_CONTRACT   "$CLAIMS"
upsert_env "$ROOT/frontend/.env" REACT_APP_ORACLE_CONTRACT   "$ORACLE"
upsert_env "$ROOT/frontend/.env" REACT_APP_HOSPITAL_CONTRACT "$HOSPITAL"

# ── 4. Backend (sync schema first, also runs oracle daemon in-process) ──
log "Starting backend on :3001 (with oracle daemon)..."
if ss -tln | grep -q ":3001 "; then
  warn "Port 3001 in use — killing existing"
  fuser -k 3001/tcp 2>/dev/null || true
  sleep 1
fi
cd "$ROOT/backend"
nohup node src/app.js > "$LOG_DIR/backend.log" 2>&1 &
echo $! > "$LOG_DIR/backend.pid"
for i in {1..15}; do
  if curl -s http://localhost:3001/api/health 2>/dev/null | grep -q ok; then
    ok "Backend ready (PID $(cat "$LOG_DIR/backend.pid"))"
    break
  fi
  [ $i -eq 15 ] && die "Backend did not start — see $LOG_DIR/backend.log"
  sleep 1
done

# ── 5. Seed demo data after schema sync ────────────────────────────────
log "Seeding demo data..."
docker cp "$ROOT/scripts/seed-demo-data.sql" insurance_db:/tmp/seed.sql > /dev/null
docker exec insurance_db mysql -u root -ppassword insurance_db -e "source /tmp/seed.sql" 2>&1 | grep -v "Warning" | sed 's/^/    /'
ok "Demo data seeded"

log "Creating real on-chain demo policies..."
cd "$ROOT"
node scripts/seed-onchain-policies.js > "$LOG_DIR/seed-onchain.log" 2>&1
ok "On-chain policies seeded"

# ── 6. External hospital service ────────────────────────────────────────
log "Starting hospital service on :3002..."
if ss -tln | grep -q ":3002 "; then
  warn "Port 3002 in use — killing existing"
  fuser -k 3002/tcp 2>/dev/null || true
  sleep 1
fi
cd "$ROOT/hospital-service"
[ -d node_modules ] || npm install > "$LOG_DIR/hospital-npm-install.log" 2>&1
nohup npm start > "$LOG_DIR/hospital.log" 2>&1 &
echo $! > "$LOG_DIR/hospital.pid"
for i in {1..15}; do
  if curl -s http://localhost:3002/api/health 2>/dev/null | grep -q ok; then
    ok "Hospital service ready (PID $(cat "$LOG_DIR/hospital.pid"))"
    break
  fi
  [ $i -eq 15 ] && die "Hospital service did not start — see $LOG_DIR/hospital.log"
  sleep 1
done

# ── 7. Frontend ────────────────────────────────────────────────────────
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
echo -e "${C_GREEN} InsurChain v3 is ready${C_OFF}"
echo -e "${C_GREEN}========================================${C_OFF}"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:3001"
echo "  Hospital:  http://localhost:3002"
echo "  Hardhat:   http://127.0.0.1:8545  (Chain ID 31337)"
echo "  MySQL:     localhost:3306  (insurance_db)"
echo ""
echo "  Contracts (auto-synced to backend/.env + frontend/.env):"
echo "    Policy:    $POLICY"
echo "    Hospital:  $HOSPITAL"
echo "    Oracle:    $ORACLE"
echo "    Claims:    $CLAIMS"
echo ""
echo "  Logs:      $LOG_DIR/"
echo "  Stop:      ./scripts/stop-all.sh"
echo ""
echo "  Hardhat accounts (import private key into MetaMask):"
echo "    Admin / Signer A : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
echo "      0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
echo "    Signer B         : 0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
echo "      0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
echo "    Signer C         : 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
echo "      0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
echo "    Customer demo    : 0x90F79bf6EB2c4f870365E785982E1f101E93b906"
echo "      0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
echo "    Hospital demo    : 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
echo "      0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"
echo "    Insurer demo     : 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"
echo "      0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"
echo ""
