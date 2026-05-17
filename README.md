# InsurChain — Blockchain Insurance Prototype

Hệ thống bảo hiểm phi tập trung: policy & claim được ghi lên smart contract (Ethereum/Hardhat), backend Node.js đồng bộ metadata vào MySQL, frontend React tương tác qua MetaMask.

## Stack

| Layer       | Tech                                                |
|-------------|------------------------------------------------------|
| Smart contracts | Solidity 0.8.24 + Hardhat + OpenZeppelin         |
| Backend     | Node.js + Express + Sequelize (MySQL) + JWT          |
| Frontend    | React 18 + react-router + ethers v6 + Tailwind       |
| Wallet      | MetaMask (sign-in qua nonce + signature)             |
| DB          | MySQL 8 (chạy bằng Docker)                           |

## Cấu trúc thư mục

```
blockchain-insurance/
├── contracts/          # Hardhat project: InsurancePolicy.sol, ClaimsProcessor.sol
├── backend/            # Express API: auth, policies, claims, files, public
├── frontend/           # React SPA: customer + admin UI
├── scripts/
│   ├── start-all.sh    # Khởi động toàn bộ stack
│   ├── stop-all.sh
│   └── seed-demo-data.sql
├── docker-compose.yml  # MySQL container
└── docs/architecture.md  # Component / ERD / Deployment diagrams
```

## Yêu cầu môi trường

- Node.js ≥ 18
- Docker + Docker Compose
- MetaMask browser extension
- Linux/macOS (script `start-all.sh` dùng bash + `sed`/`lsof`/`fuser`)

## Run all services (1 lệnh)

```bash
cd blockchain-insurance
./scripts/start-all.sh
```

Script sẽ tự động:
1. Start MySQL container (port 3306)
2. Start Hardhat node (port 8545, chain ID `31337`)
3. Deploy 2 smart contracts → tự sync địa chỉ vào `backend/.env` & `frontend/.env`
4. Seed demo data vào MySQL
5. Start backend (port 3001)
6. Start frontend (port 3000)

Logs: `.logs/{hardhat,backend,frontend,deploy}.log`. Dừng: `./scripts/stop-all.sh`.

## Run thủ công (debug từng phần)

```bash
# 1. MySQL
docker compose up -d

# 2. Hardhat node (giữ terminal mở)
cd contracts && npm install && npx hardhat node

# 3. Deploy contracts (terminal khác)
cd contracts && npx hardhat run scripts/deploy.js --network localhost
# → copy CONTRACT_ADDRESS_POLICY / CONTRACT_ADDRESS_CLAIMS vào backend/.env và frontend/.env

# 4. Backend
cd backend && npm install
cp .env.example .env   # nếu chưa có
npm run dev            # nodemon, hoặc: npm start

# 5. Frontend
cd frontend && npm install
npm start              # http://localhost:3000
```

## Cấu hình MetaMask

1. Networks → Add network → **Hardhat Local**
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Symbol: `ETH`
2. Import account: dùng private key in ra ở cuối script `start-all.sh` (admin có 10,000 ETH).
3. Hoặc import bất kỳ account nào từ output của `npx hardhat node`.

## Env vars

### backend/.env
```
PORT=3001
DB_HOST=localhost
DB_NAME=insurance_db
DB_USER=root
DB_PASS=password
JWT_SECRET=supersecretkey123
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS_POLICY=   # sync tự động bởi start-all.sh
CONTRACT_ADDRESS_CLAIMS=
ADMIN_WALLET=
PRIVATE_KEY=               # admin key dùng để gọi onlyAdmin từ backend
```

### frontend/.env
```
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_POLICY_CONTRACT=
REACT_APP_CLAIMS_CONTRACT=
REACT_APP_CHAIN_ID=31337
```

## Smart contracts

- **InsurancePolicy.sol** — admin tạo policy cho customer; lưu premium, max coverage, thời hạn, document hash. Events: `PolicyCreated`, `PolicyCancelled`.
- **ClaimsProcessor.sol** — customer submit claim; admin approve/reject. Khi approve, contract tự chuyển ETH cho claimant. Events: `ClaimSubmitted`, `ClaimStatusUpdated`, `ClaimPaid`.

## API endpoints (tóm tắt)

| Method | Path                         | Auth         | Mô tả |
|--------|------------------------------|--------------|-------|
| GET    | `/api/auth/nonce?wallet=…`   | public       | Lấy nonce để ký |
| POST   | `/api/auth/login`            | public       | Verify chữ ký → JWT |
| GET    | `/api/auth/me`               | JWT          | Thông tin user hiện tại |
| GET    | `/api/policies`              | JWT          | List policies (customer thấy của mình, admin thấy tất cả) |
| POST   | `/api/policies`              | admin        | Tạo policy (đồng bộ on-chain) |
| GET    | `/api/policies/:id`          | JWT          | Chi tiết policy |
| PATCH  | `/api/policies/:id/cancel`   | admin        | Huỷ policy |
| GET    | `/api/claims`                | JWT          | List claims |
| POST   | `/api/claims`                | customer     | Tạo claim record (sau khi submit on-chain) |
| GET    | `/api/claims/:id`            | JWT          | Chi tiết claim |
| PATCH  | `/api/claims/:id/approve`    | admin        | Duyệt + trigger payout |
| PATCH  | `/api/claims/:id/reject`     | admin        | Từ chối |
| PATCH  | `/api/claims/:id/status`     | admin        | Đổi trạng thái (under_review, needs_info…) |
| POST   | `/api/files/upload`          | JWT          | Upload evidence (multipart) |
| GET    | `/api/files/:id`             | JWT          | Tải file |
| GET    | `/api/public/transactions`   | public       | Lịch sử tx (transparency layer) |
| GET    | `/api/public/stats`          | public       | Số liệu tổng quan |

## Auth flow (MetaMask sign-in)

1. Frontend `GET /auth/nonce?wallet=0x…` → backend tạo/load user, trả nonce.
2. MetaMask ký message `Sign in to Insurance App: <nonce>`.
3. Frontend `POST /auth/login` { wallet, signature } → backend dùng `ethers.verifyMessage`, rotate nonce, phát hành JWT (7 ngày).
4. Mọi request tiếp theo gửi `Authorization: Bearer <token>`.

## Tài liệu thêm

- Kiến trúc + ERD + deployment: [`docs/architecture.md`](docs/architecture.md)

## Troubleshooting

- **MetaMask không kết nối được**: kiểm tra network đang chọn là Hardhat Local (chain 31337); reset account sau khi restart Hardhat node (Settings → Advanced → Clear activity tab data).
- **Backend báo `Failed to sync database`**: chờ MySQL container ready (`docker logs insurance_db`).
- **Contract address không khớp**: chạy lại `./scripts/start-all.sh` — script tự ghi đè `.env`.
- **Port conflict**: script tự kill process trên 3000/3001; với 8545/3306 cần xử lý thủ công.
