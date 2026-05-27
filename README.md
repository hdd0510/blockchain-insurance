# InsurChain v3 — Blockchain Insurance With Real Hospital Verification Flow

InsurChain v3 là bản nâng cấp từ demo mock sang mô hình gần thực tế hơn với
`4` role đăng nhập:

- `customer`
- `hospital`
- `insurer`
- `admin`

Hệ thống kết hợp:

- smart contract xử lý claim và payout on-chain
- custom oracle service làm cầu nối tới hospital system
- hospital service external chạy cổng riêng
- hospital records trong MySQL để xác minh hồ sơ thật hơn
- manual verification bởi hospital operator thay vì random mock

## Những gì đã thay đổi so với bản cũ

| Hạng mục | Bản cũ | Bản mới |
|---|---|---|
| Actor | `customer`, `admin`, `hospital` | `customer`, `hospital`, `insurer`, `admin` |
| Hospital verify | random mock | tra `hospital_records` + hospital user xác nhận thủ công |
| Oracle | tự gọi verify và tự quyết nhanh | tạo `pending_manual`, chờ hospital review rồi mới fulfill |
| Hospital API | nằm chung backend | tách `hospital-service` riêng trên `:3002` |
| Evidence storage | local uploads | mock IPFS + `bytes32 evidenceHash` on-chain |
| Claim operations | admin xử lý nghiệp vụ | `insurer` là actor nghiệp vụ chính |
| Audit | log cơ bản | giữ audit log off-chain xuyên suốt claim / hospital / appeal |

## Kiến trúc mức cao

1. `customer` submit claim on-chain bằng MetaMask.
2. Backend mirror claim vào MySQL.
3. `insurer` ký multi-sig để claim đi vào bước xác minh.
4. Smart contract gọi `MockOracle.requestVerification`.
5. Oracle service nghe event, gọi `hospital-service` external để dò record.
6. Oracle ghi `hospital_verifications.status = pending_manual`.
7. `hospital` đăng nhập portal, xem record match và tự xác nhận `verified` hoặc
   `not_verified`.
8. Oracle key fulfill lại smart contract.
9. Smart contract tự payout hoặc reject.
10. Backend sync trạng thái về MySQL và ghi `audit_logs`.

Chi tiết hơn: [docs/architecture.md](docs/architecture.md)  
Report đầy đủ: [docs/system-report.md](docs/system-report.md)

## Cấu trúc thư mục

```text
blockchain-insurance/
├── contracts/           # Hardhat contracts + tests
├── backend/             # Express API + oracle daemon + Sequelize models
├── frontend/            # React SPA cho customer / hospital / insurer / admin
├── hospital-service/    # External demo hospital API
├── scripts/             # start-all, stop-all, seed SQL
└── docs/                # architecture + system report
```

## Stack

- Smart contracts: Solidity 0.8.24, Hardhat, ethers
- Backend: Node.js, Express, Sequelize, MySQL
- Frontend: React 18, react-router, ethers
- External hospital service: Express + mysql2
- Wallet: MetaMask

## Role model

### `customer`

- đăng nhập bằng ví
- gửi claim
- upload evidence
- xem trạng thái claim
- nộp appeal

### `hospital`

- đăng nhập bằng ví bệnh viện đã được registry
- xem verification request được gán cho ví của mình
- xem hồ sơ từ `hospital_records`
- xác nhận thủ công `verified / not_verified`

### `insurer`

- xem toàn bộ claim nghiệp vụ
- ký multi-sig xử lý claim
- reject thủ công trong case đặc biệt
- review appeal
- theo dõi verification status

### `admin`

- quản trị hệ thống
- tạo / hủy policy
- đăng ký hospital
- xem audit logs
- cấu hình signer / registry

## Run all services

```bash
cd blockchain-insurance
./scripts/start-all.sh
```

Script sẽ:

1. start MySQL
2. start Hardhat node
3. deploy `InsurancePolicy`, `HospitalRegistry`, `MockOracle`, `ClaimsProcessor`
4. seed users, policies, hospital records
5. start external `hospital-service` trên `:3002`
6. start backend trên `:3001`
7. start frontend trên `:3000`

## Demo accounts

Tài khoản chính trong script:

- `Admin / Signer A`: quản trị hệ thống
- `Signer B`, `Signer C`: signer multi-sig
- `Customer demo`: nộp claim
- `Hospital demo`: xác minh hồ sơ
- `Insurer demo`: xử lý nghiệp vụ claim

Private keys được script in ra ở cuối `start-all.sh`.

## Demo hospital records

Để demo flow hospital verification:

- `PATIENT-001`
  - có record `HS-001`
  - `claimable = true`
  - hospital có thể xác nhận `verified`

- `PATIENT-002`
  - có record `HS-002`
  - `claimable = false`
  - hospital có thể xác nhận `not_verified`

Frontend tự hash `patient_id` trước khi gửi on-chain.

## API highlights

### Backend insurance app

- `GET /api/claims`
- `POST /api/claims/:id/sign`
- `PATCH /api/claims/:id/reject`
- `GET /api/hospital/verifications`
- `POST /api/hospital/verifications/:id/manual`
- `GET /api/hospital/catalog`
- `GET /api/audit-logs`

### External hospital service

- `POST /api/hospital/records/match`

Service này không tự quyết payout. Nó chỉ trả record match để oracle tạo
request `pending_manual`.

## On-chain / off-chain split

### On-chain

- policy validity
- claim submission
- multi-sig approvals
- oracle request
- final payout / reject
- appeal state machine
- timeout / expire

### Off-chain

- user roles
- JWT auth
- file pinning metadata
- hospital records
- hospital verification workflow
- audit logs

## Security notes

- Customer actions vẫn ký trực tiếp bằng MetaMask.
- Một số admin/oracle actions trong demo vẫn dùng private key lưu trong
  backend `.env`.
- Contract đã dùng multi-sig `N/M`, nhưng secret management vẫn là dạng demo.
- Hospital verification nay không còn random, nhưng vẫn là demo DB nội bộ chứ
  chưa phải HIS/EMR production.

## Testing

### Contracts

```bash
cd contracts
npm test -- --no-compile
```

### Backend helper tests

```bash
cd backend
npm test
```

## Main docs

- [docs/architecture.md](docs/architecture.md)
- [docs/system-report.md](docs/system-report.md)
