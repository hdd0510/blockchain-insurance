# InsurChain v3 System Report

## 1. Executive Summary

InsurChain v3 là hệ thống bảo hiểm blockchain dùng smart contract để ghi nhận
claim và thanh toán tự động, nhưng dịch chuyển phần xác minh y tế ra off-chain
theo mô hình gần thực tế hơn:

- bệnh viện có hồ sơ nội bộ
- hospital operator xác minh thủ công
- insurer là actor nghiệp vụ riêng
- oracle chỉ là cầu nối kỹ thuật

Mục tiêu của bản nâng cấp này là loại bỏ các điểm yếu của prototype cũ:

- random hospital verification
- thiếu actor insurer thật
- hospital API nằm chung backend
- tài liệu chưa khớp với luồng thực tế

## 2. Actors And Responsibilities

### 2.1 Customer

Customer là người sở hữu policy và nộp yêu cầu bồi thường.

Chức năng:

- đăng nhập bằng MetaMask
- gửi claim
- upload bằng chứng
- theo dõi trạng thái
- nộp appeal khi claim bị reject

Customer chỉ ký các transaction của chính mình.

### 2.2 Hospital

Hospital là đơn vị xác minh hồ sơ y tế.

Chức năng:

- đăng nhập bằng ví hospital đã được register
- xem hàng đợi verification được gửi đến đúng hospital wallet
- xem record match từ `hospital_records`
- tự chọn `verified` hoặc `not_verified`

Điểm khác biệt chính so với bản cũ là hospital không còn bị thay bằng random
mock logic. Hospital user là người đưa ra kết luận cuối cùng cho hồ sơ.

### 2.3 Insurer

Insurer là actor nghiệp vụ mới.

Chức năng:

- xem toàn bộ claim nghiệp vụ
- ký multi-sig xử lý claim
- reject thủ công trong case ngoại lệ
- review appeal
- theo dõi verification queue

Việc thêm `insurer` role giúp phân tách rõ:

- `admin`: quản trị hệ thống
- `insurer`: xử lý nghiệp vụ bảo hiểm

### 2.4 Admin

Admin là actor quản trị.

Chức năng:

- tạo / hủy policy
- đăng ký hospital
- xem audit logs
- quản trị signer và registry

Admin không còn là actor chính cho mọi thao tác claim như bản cũ.

### 2.5 Oracle Service

Oracle service không phải user đăng nhập mà là service kỹ thuật.

Chức năng:

- lắng nghe `VerificationRequested`
- gọi external hospital service để tìm medical record phù hợp
- tạo `hospital_verifications` với trạng thái `pending_manual`
- dùng oracle key fulfill lại smart contract sau khi hospital đã xác nhận

Oracle service không tự phán quyết đúng/sai.

## 3. End-To-End Claim Lifecycle

### 3.1 Submit claim

1. Customer đăng nhập bằng MetaMask.
2. Chọn policy.
3. Nhập `patient_id`.
4. Chọn hospital wallet.
5. Upload evidence.
6. Frontend hash `patient_id` trước khi submit on-chain.
7. Smart contract tạo claim.
8. Backend mirror claim vào MySQL.

### 3.2 Insurer review and multi-sig

1. Insurer mở claim queue.
2. Ký multi-sig cho claim.
3. Khi đủ ngưỡng `N/M`, `ClaimsProcessor` tự gọi oracle request.

Ở bản demo hiện tại, backend vẫn có thể ký bằng private keys trong `.env` để
giữ tốc độ demo. Tuy nhiên logic multi-sig trên chain là thật.

### 3.3 Oracle request and hospital record lookup

1. `MockOracle` emit `VerificationRequested`.
2. Oracle daemon bắt event.
3. Oracle gọi `hospital-service` tại `POST /api/hospital/records/match`.
4. Hospital service tra bảng `hospital_records`.
5. Kết quả trả về là:
   - có record khớp
   - hoặc không có record khớp
6. Oracle tạo bản ghi `hospital_verifications` với trạng thái
   `pending_manual`.

Điểm quan trọng:

- đây chưa phải verdict cuối cùng
- chỉ là dữ liệu chuẩn bị cho hospital operator review

### 3.4 Manual hospital verification

1. Hospital user đăng nhập vào portal.
2. Xem verification request được gắn với hospital wallet của mình.
3. Xem thông tin record match:
   - patient name
   - record number
   - diagnosis
   - coverage hint
   - note
4. Chọn:
   - `verified`
   - `not_verified`
5. Backend dùng oracle key để gọi `fulfillVerification(...)` on-chain.

Như vậy hospital mới là actor xác minh thật. Oracle chỉ submit kết quả mà
hospital đã xác nhận.

### 3.5 On-chain finalization

Sau khi smart contract nhận callback:

- nếu `verified = true`
  - claim chuyển qua trạng thái payout
  - ETH được chuyển vào ví customer
- nếu `verified = false`
  - claim bị reject

Trạng thái cuối cùng vẫn do smart contract quyết định.

### 3.6 Appeal flow

Nếu claim bị reject:

1. Customer file appeal.
2. Insurer review appeal.
3. Nếu threshold accept đạt:
   - smart contract re-trigger oracle verification
4. Nếu appeal bị reject:
   - claim kết thúc ở trạng thái final reject

## 4. Data Model Explanation

### 4.1 `users`

Lưu wallet và role của mọi actor:

- customer
- hospital
- insurer
- admin

### 4.2 `claims`

Mirror off-chain của claim on-chain.

Lý do cần bảng này:

- UI query nhanh hơn
- join với files, appeal, verifications
- giữ metadata off-chain

### 4.3 `claim_files`

Lưu:

- `ipfs_cid`
- `content_hash`
- mime, size, filename

Blockchain chỉ lưu `bytes32 evidenceHash`, không lưu file trực tiếp.

### 4.4 `hospital_records`

Đây là bảng mới để thay random mock.

Ví dụ mỗi record chứa:

- hospital wallet
- patient hash
- record number
- diagnosis
- treatment window
- claimable flag
- coverage amount

Oracle và hospital portal dùng bảng này làm nguồn xác minh demo.

### 4.5 `hospital_verifications`

Mỗi request oracle tạo một row tại đây.

Các field quan trọng:

- `oracle_request_id`
- `hospital_wallet`
- `source_record_id`
- `result`
- `status`
- `reviewed_by_wallet`
- `oracle_tx_hash`

Trạng thái điển hình:

1. `pending_manual`
2. `fulfilled`
3. hoặc `fulfill_failed`

### 4.6 `audit_logs`

Lưu audit trail off-chain:

- ai làm gì
- lúc nào
- entity nào
- old/new value
- tx hash nếu có

## 5. Security Model

## 5.1 Login security

Login dựa trên:

- nonce
- MetaMask signature
- backend verify signature
- JWT cho các request tiếp theo

Điều này chứng minh người dùng sở hữu ví tương ứng.

## 5.2 Transaction signing

Phải phân biệt:

- login signing
- blockchain transaction signing

Customer transactions do customer tự ký bằng MetaMask.

Một số transaction vận hành hiện do backend ký bằng private key trong `.env`,
ví dụ:

- insurer sign approval
- hospital register
- oracle fulfill

Đây vẫn là giới hạn của bản demo.

## 5.3 Multi-sig protection

So với bản cũ chỉ có một admin key, bản mới đã thêm:

- nhiều admin signers
- threshold `N/M`
- claim chỉ đi tiếp khi đủ chữ ký

Nhờ đó payout không còn phụ thuộc vào duy nhất một signer.

## 5.4 Remaining limitations

- backend vẫn giữ một số private key
- hospital service vẫn dùng chung MySQL demo
- external hospital service chưa có auth sâu ngoài token
- chưa có keeper riêng cho timeout automation

## 6. Why This Version Is More Realistic

### 6.1 Không còn random verification

Bản cũ dùng quy tắc ngẫu nhiên theo hash. Bản mới dùng:

- DB record thật hơn
- actor hospital thật
- thao tác manual review thật

### 6.2 Insurer là actor nghiệp vụ rõ ràng

Thay vì nhét mọi thứ vào `admin`, giờ quy trình nghiệp vụ phản ánh gần hơn mô
hình bảo hiểm thực:

- admin quản trị
- insurer xử lý claim
- hospital xác minh

### 6.3 Hospital API là external system

Bản mới tách `hospital-service` ra port riêng, nên sequence diagram và
deployment diagram phù hợp với kiến trúc service-to-service thực tế hơn.

## 7. Demo Walkthrough

### Case A: verified payout

1. Login bằng customer demo.
2. Tạo claim với:
   - hospital demo wallet
   - `PATIENT-001`
3. Login bằng insurer demo.
4. Ký multi-sig cho claim.
5. Login bằng hospital demo.
6. Mở hospital portal.
7. Xem request `pending_manual`.
8. Chọn `Verified`.
9. Claim được fulfill và payout on-chain.

### Case B: rejected by hospital

Làm tương tự nhưng dùng:

- `PATIENT-002`

Hospital sẽ thấy record tồn tại nhưng `claimable = false`, từ đó có thể chọn
`Not verified`.

## 8. Suggested Next Improvements

Nếu muốn nâng thêm một bậc nữa sau đồ án:

1. Dùng IPFS thật qua Pinata hoặc Kubo.
2. Cho insurer sign bằng MetaMask thật thay vì backend-held keys.
3. Tách MySQL của hospital service khỏi insurance backend.
4. Dùng Chainlink Automation cho timeout.
5. Thêm dashboard analytics và SLA monitoring.

## 9. Conclusion

InsurChain v3 giữ được ưu điểm của prototype blockchain ban đầu nhưng nâng cấp
phần nghiệp vụ off-chain theo hướng hợp lý hơn:

- role rõ ràng
- hospital verification thật hơn
- insurer là actor độc lập
- docs và diagrams khớp với hệ thống

Đây là phiên bản phù hợp hơn để demo, báo cáo và bảo vệ kiến trúc hệ thống.
