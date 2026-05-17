# Demo Accounts

Tài khoản test có sẵn để demo InsurChain. Các private key dưới đây là **Hardhat default accounts** — chỉ dùng cho local dev, **TUYỆT ĐỐI không nạp ETH thật**.

## Cách import vào MetaMask

1. Mở MetaMask → biểu tượng tròn góc phải → **Add account / Import account**
2. Chọn **Private Key**, paste key bên dưới → Import
3. Đảm bảo đang ở network **Hardhat Local** (Chain ID `31337`, RPC `http://127.0.0.1:8545`)
4. Mỗi account khởi tạo có **10,000 ETH** trong Hardhat node

## Admin

| Field      | Value |
|------------|-------|
| Tên        | Admin |
| Email      | admin@insurance.com |
| Role       | `admin` |
| Wallet     | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| Private key| `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |

Quyền: tạo/huỷ policy, approve/reject/update claim, xem mọi user.

## Customers

Đã seed sẵn policy + claim cho 4 customer dưới (xem chi tiết ở phần "Seed data").

### Customer #1 — Nguyen Van An
| Field | Value |
|-------|-------|
| Email | an.nguyen@gmail.com |
| Wallet | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| Private key | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| Policies | #103 vehicle (active), #104 travel (active) |
| Claims | #203 pending, #204 under_review |

### Customer #2 — Tran Thi Binh
| Field | Value |
|-------|-------|
| Email | binh.tran@gmail.com |
| Wallet | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` |
| Private key | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| Policies | #105 property (active), #106 health (expired) |
| Claims | #205 paid, #206 rejected |

### Customer #3 — Le Hoang Cuong
| Field | Value |
|-------|-------|
| Email | cuong.le@gmail.com |
| Wallet | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` |
| Private key | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |
| Policies | #107 vehicle (active) |
| Claims | #207 approved |

### Customer #4 — Pham Mai Dung
| Field | Value |
|-------|-------|
| Email | dung.pham@gmail.com |
| Wallet | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` |
| Private key | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |
| Policies | #108 health (active) |
| Claims | #208 needs_info |

## Hardhat extra accounts (chưa seed, dùng làm customer mới để test create policy)

| # | Wallet | Private key |
|---|--------|-------------|
| 5 | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` | `0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba` |
| 6 | `0x976EA74026E726554dB657fA54763abd0C3a0aa9` | `0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e` |
| 7 | `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955` | `0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356` |
| 8 | `0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f` | `0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97` |
| 9 | `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720` | `0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6` |

## Demo flow đề xuất

### Kịch bản 1 — Customer xem policy & claim hiện có
1. Import **Customer #1 (An)**
2. Login app → vào **Policies** xem 2 policy (#103, #104)
3. Vào **Claims** xem trạng thái 2 claim đang xử lý
4. Vào **Transactions** xem lịch sử on-chain

### Kịch bản 2 — Customer submit claim mới
1. Login bằng **Customer #3 (Cuong)** — có policy #107 active
2. **New Claim** → chọn policy #107, nhập amount (vd. 0.05 ETH)
3. Upload file evidence → ký tx qua MetaMask
4. Quay lại **Claims** thấy claim ở trạng thái `pending`

### Kịch bản 3 — Admin duyệt claim
1. Logout, import lại **Admin**
2. Login → vào **Admin / Claims**
3. Chọn claim `pending` của Cuong → **Approve**
4. MetaMask popup ký tx → contract chuyển ETH cho claimant
5. Status đổi thành `paid`, balance của Cuong tăng tương ứng

### Kịch bản 4 — Admin tạo policy mới
1. Login bằng **Admin**
2. **Admin / Policies → New Policy**
3. Customer wallet: dùng account #5 (`0x9965...`)
4. Chọn type, premium, max coverage, duration → submit
5. Đăng xuất, import account #5 → login → thấy policy mới

## Lưu ý quan trọng

- **Reset Hardhat** = mất state on-chain. Phải re-run `./scripts/start-all.sh` để deploy lại contract + seed lại DB. MetaMask cần **Settings → Advanced → Clear activity tab data** để clear nonce cache.
- **MySQL data** persist trong docker volume `mysql_data`. Muốn xoá hoàn toàn: `docker compose down -v`.
- **Seed lại data**: `docker exec -i insurance_db mysql -uroot -ppassword insurance_db < scripts/seed-demo-data.sql`
- Các tx_hash + evidence_hash trong seed là **giả lập** (không có thật on-chain), chỉ phục vụ UI demo. Claim mới do user submit mới có tx_hash thật.

## Unresolved

- Seed policy #101, #102 thuộc wallet `0x9d6f...dfcd` (không trong danh sách Hardhat default) — có thể là wallet test cũ. Customer không thể login bằng ví này vì không có private key tương ứng. Có thể bỏ hoặc đổi sang một trong các Hardhat account ở lần seed sau.
