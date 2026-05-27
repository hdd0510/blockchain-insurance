# Real Hospital And Insurer Flow Design

## Goal

Nâng InsurChain từ demo mock sang luồng nghiệp vụ gần thực tế hơn với 4 role
đăng nhập: `customer`, `hospital`, `insurer`, `admin`.

## Scope

- Thêm role `insurer` trong backend và frontend.
- Thay logic hospital verify ngẫu nhiên bằng tra cứu hồ sơ demo thật từ DB.
- Chuyển luồng xác minh sang `pending manual verification`.
- Giữ smart contract oracle hiện có, nhưng oracle service không tự đưa ra
  verdict; nó chỉ tạo request pending và fulfill sau khi hospital xác minh.
- Cập nhật docs, diagrams, và viết report hệ thống chi tiết.

## Role Model

- `customer`: nộp claim, upload evidence, theo dõi trạng thái, gửi appeal.
- `hospital`: nhận request xác minh, tra cứu hồ sơ, xác nhận verified /
  not_verified.
- `insurer`: xử lý nghiệp vụ claim, xem kết quả hospital, ký multi-sig, review
  appeal, theo dõi SLA.
- `admin`: quản trị hệ thống, registry, seed users, audit, hospital registry,
  không là actor nghiệp vụ chính của claim.

## Verification Flow

1. Customer submit claim on-chain và mirror vào MySQL.
2. Insurer xem claim, thu đủ multi-sig qua backend.
3. Contract phát `VerificationRequested`.
4. Oracle service tạo bản ghi `hospital_verifications` với trạng thái
   `pending_manual`.
5. Hospital user vào portal, xem hồ sơ từ bảng `hospital_records`, xác nhận
   verdict thủ công.
6. Sau khi verdict có sẵn, oracle service fulfill on-chain.
7. Smart contract tự payout hoặc reject.
8. Backend sync trạng thái on-chain về MySQL và ghi audit log.

## Data Model Changes

- `users.role`: thêm `insurer`.
- Bảng mới `hospital_records`:
  - `id`
  - `hospital_wallet`
  - `patient_id_hash`
  - `patient_name`
  - `record_number`
  - `diagnosis`
  - `treatment_date`
  - `discharge_date`
  - `claimable`
  - `coverage_amount_eth`
  - `note`
- Bảng `hospital_verifications`:
  - thêm `status` chi tiết hơn: `pending_manual`, `verified`, `not_verified`,
    `fulfilled`, `fulfill_failed`
  - thêm `reviewed_by_wallet`
  - thêm `manual_reviewed_at`
  - thêm `source_record_id`

## API Design

- Backend insurance app:
  - `GET /api/claims` cho `insurer` như admin claims ops.
  - `POST /api/claims/:id/sign` cho `insurer`.
  - `PATCH /api/claims/:id/reject` cho `insurer`.
  - `GET /api/hospital/verifications` cho `hospital`, `insurer`, `admin`.
  - `POST /api/hospital/verifications/:id/manual` cho `hospital`.
  - `POST /api/hospital/verifications/:id/fulfill` cho `insurer` hoặc oracle
    worker nội bộ.
- Hospital service mock-real:
  - chạy như external service trên port riêng
  - đọc bảng `hospital_records`
  - trả hồ sơ khớp theo `hospital_wallet + patient_id_hash`

## Testing

- Unit-style tests cho hospital record lookup và manual verification gating.
- Contract tests giữ nguyên luồng oracle callback.
- Smoke tests cho insurer access control và role-based routing.

## Documentation

- Cập nhật `README.md`.
- Cập nhật `docs/architecture.md`.
- Viết report chi tiết về actor, data flow, security trade-offs, diagrams,
  deployment, limitation, next steps.
