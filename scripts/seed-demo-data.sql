-- Demo data seed for InsurChain v2
-- Idempotent: safe to run multiple times. Clears prior seed rows first.

ALTER TABLE users
  MODIFY role ENUM('admin','customer','hospital','insurer') NOT NULL DEFAULT 'customer';

-- Admin + admin signers (Hardhat accounts #0, #1, #2)
INSERT INTO users (wallet_address, role, full_name, email, nonce, created_at, updated_at) VALUES
('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 'admin', 'Admin / Signer A', 'admin@insurance.com',  'init', NOW(), NOW()),
('0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 'admin', 'Signer B',          'signer-b@insurance.com', 'b1', NOW(), NOW()),
('0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', 'admin', 'Signer C',          'signer-c@insurance.com', 'c1', NOW(), NOW())
ON DUPLICATE KEY UPDATE role='admin';

-- Customer (Hardhat account #3)
INSERT INTO users (wallet_address, role, full_name, email, nonce, created_at, updated_at) VALUES
('0x90f79bf6eb2c4f870365e785982e1f101e93b906', 'customer', 'Le Hoang Cuong', 'cuong.le@gmail.com', 'n3', NOW(), NOW())
ON DUPLICATE KEY UPDATE role='customer';

-- Insurer operations user (Hardhat account #5 / demo insurer)
INSERT INTO users (wallet_address, role, full_name, email, nonce, created_at, updated_at) VALUES
('0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc', 'insurer', 'Demo Insurer', 'insurer@insurance.com', 'i5', NOW(), NOW())
ON DUPLICATE KEY UPDATE role='insurer';

-- Hospital demo user (Hardhat account #4)
INSERT INTO users (wallet_address, role, full_name, hospital_name, email, nonce, created_at, updated_at) VALUES
('0x15d34aaf54267db7d7c367839aaf71a00a2c6a65', 'hospital', 'Demo Hospital', 'Demo Hospital', 'hospital@insurance.com', 'h1', NOW(), NOW())
ON DUPLICATE KEY UPDATE role='hospital', hospital_name='Demo Hospital';

-- Reset claims/policies (keep users + appeals + audit logs intact-ish)
DELETE FROM hospital_verifications;
DELETE FROM hospital_records;
DELETE FROM appeals;
DELETE FROM claim_files;
DELETE FROM claims;
DELETE FROM policies WHERE chain_policy_id IS NOT NULL;

-- Sample policies for the demo customer
INSERT INTO policies (chain_policy_id, customer_wallet, policy_type, premium_eth, max_coverage_eth, start_date, end_date, status, tx_hash, created_at, updated_at) VALUES
(101, '0x90f79bf6eb2c4f870365e785982e1f101e93b906', 'health',  0.02, 1.0, DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 335 DAY), 'active', '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2', NOW(), NOW()),
(102, '0x90f79bf6eb2c4f870365e785982e1f101e93b906', 'vehicle', 0.01, 0.5, DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 350 DAY), 'active', '0xb1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2', NOW(), NOW());

-- Demo hospital records used by the external hospital service and hospital portal
INSERT INTO hospital_records (
  hospital_wallet, patient_id_hash, patient_name, record_number, diagnosis,
  treatment_date, discharge_date, claimable, coverage_amount_eth, note, created_at, updated_at
) VALUES
(
  '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65',
  '0x04397822d482bd33ff80cb77d5bb1420db377a25e4b05ad8be444eacfde0f01f',
  'Nguyen Van A',
  'HS-001',
  'Fracture surgery',
  '2026-05-01',
  '2026-05-08',
  1,
  0.80,
  'Eligible inpatient record for policy demo claim.',
  NOW(),
  NOW()
),
(
  '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65',
  '0xe2538c032414541537980e02c9b7e398e6a2c1c7d83cbc7f26433b0735681028',
  'Tran Thi B',
  'HS-002',
  'Outpatient consultation',
  '2026-05-11',
  '2026-05-11',
  0,
  0.05,
  'Record exists but marked not claimable for insurance payout.',
  NOW(),
  NOW()
);

SELECT 'users' AS t, COUNT(*) AS n FROM users
UNION SELECT 'policies', COUNT(*) FROM policies
UNION SELECT 'claims', COUNT(*) FROM claims
UNION SELECT 'hospital_verifications', COUNT(*) FROM hospital_verifications
UNION SELECT 'hospital_records', COUNT(*) FROM hospital_records;
