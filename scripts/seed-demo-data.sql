-- Demo data seed for InsurChain
-- Idempotent: safe to run multiple times. Clears prior seed rows first.

-- Admin (Hardhat account #0)
INSERT INTO users (wallet_address, role, full_name, email, nonce, created_at, updated_at) VALUES
('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', 'admin', 'Admin', 'admin@insurance.com', 'init', NOW(), NOW())
ON DUPLICATE KEY UPDATE role='admin';

-- Customers (Hardhat accounts #1-#4)
INSERT INTO users (wallet_address, role, full_name, email, nonce, created_at, updated_at) VALUES
('0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 'customer', 'Nguyen Van An',  'an.nguyen@gmail.com',  'n1', NOW(), NOW()),
('0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', 'customer', 'Tran Thi Binh',  'binh.tran@gmail.com',  'n2', NOW(), NOW()),
('0x90f79bf6eb2c4f870365e785982e1f101e93b906', 'customer', 'Le Hoang Cuong', 'cuong.le@gmail.com',   'n3', NOW(), NOW()),
('0x15d34aaf54267db7d7c367839aaf71a00a2c6a65', 'customer', 'Pham Mai Dung',  'dung.pham@gmail.com',  'n4', NOW(), NOW())
ON DUPLICATE KEY UPDATE role=role;

-- Reset claims/policies (keep users)
DELETE FROM claim_files;
DELETE FROM claims;
DELETE FROM policies WHERE chain_policy_id IS NOT NULL;

-- Policies spread across customers
INSERT INTO policies (chain_policy_id, customer_wallet, policy_type, premium_eth, max_coverage_eth, start_date, end_date, status, tx_hash, created_at, updated_at) VALUES
(101, '0x9d6ffe940a835113725232f795d7a18f8399dfcd', 'vehicle',   0.01,  0.5, DATE_SUB(NOW(), INTERVAL 30 DAY),  DATE_ADD(NOW(), INTERVAL 335 DAY), 'active',  '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2', NOW(), NOW()),
(102, '0x9d6ffe940a835113725232f795d7a18f8399dfcd', 'health',    0.02,  1.0, DATE_SUB(NOW(), INTERVAL 60 DAY),  DATE_ADD(NOW(), INTERVAL 120 DAY), 'active',  '0xb1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2', NOW(), NOW()),
(103, '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 'vehicle',   0.015, 0.7, DATE_SUB(NOW(), INTERVAL 45 DAY),  DATE_ADD(NOW(), INTERVAL 320 DAY), 'active',  '0xc1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5c6d7e8f9a0b1c2', NOW(), NOW()),
(104, '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 'travel',    0.005, 0.3, DATE_SUB(NOW(), INTERVAL 15 DAY),  DATE_ADD(NOW(), INTERVAL 75 DAY),  'active',  '0xd1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2', NOW(), NOW()),
(105, '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', 'property',  0.05,  3.0, DATE_SUB(NOW(), INTERVAL 90 DAY),  DATE_ADD(NOW(), INTERVAL 275 DAY), 'active',  '0xe1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2', NOW(), NOW()),
(106, '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', 'health',    0.025, 1.2, DATE_SUB(NOW(), INTERVAL 200 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY),  'expired', '0xf1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2', NOW(), NOW()),
(107, '0x90f79bf6eb2c4f870365e785982e1f101e93b906', 'vehicle',   0.012, 0.6, DATE_SUB(NOW(), INTERVAL 20 DAY),  DATE_ADD(NOW(), INTERVAL 345 DAY), 'active',  '0xa2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3', NOW(), NOW()),
(108, '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65', 'health',    0.02,  1.0, DATE_SUB(NOW(), INTERVAL 75 DAY),  DATE_ADD(NOW(), INTERVAL 290 DAY), 'active',  '0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3', NOW(), NOW());

-- Claims with diverse statuses
INSERT INTO claims (chain_claim_id, policy_id, claimant_wallet, amount_eth, evidence_hash, status, reject_reason, tx_hash, submitted_at, processed_at, created_at, updated_at) VALUES
(201, (SELECT id FROM policies WHERE chain_policy_id=101), '0x9d6ffe940a835113725232f795d7a18f8399dfcd', 0.08, 'QmX1evidenceHash1234567890abcdef',  'paid',         NULL, '0x111aaa222bbb333ccc444ddd555eee666fff777aaa888bbb999ccc000ddd111e', DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 18 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY), NOW()),
(202, (SELECT id FROM policies WHERE chain_policy_id=102), '0x9d6ffe940a835113725232f795d7a18f8399dfcd', 0.15, 'QmX2evidenceHashHospitalReceipts', 'approved',     NULL, '0x222aaa333bbb444ccc555ddd666eee777fff888aaa999bbb000ccc111ddd222e', DATE_SUB(NOW(), INTERVAL 5 DAY),  DATE_SUB(NOW(), INTERVAL 2 DAY),  DATE_SUB(NOW(), INTERVAL 5 DAY),  NOW()),
(203, (SELECT id FROM policies WHERE chain_policy_id=103), '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 0.12, 'QmX3evidenceHashTrafficAccident',  'pending',      NULL, '0x333aaa444bbb555ccc666ddd777eee888fff999aaa000bbb111ccc222ddd333e', DATE_SUB(NOW(), INTERVAL 2 DAY),  NULL,                              DATE_SUB(NOW(), INTERVAL 2 DAY),  NOW()),
(204, (SELECT id FROM policies WHERE chain_policy_id=104), '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 0.06, 'QmX4evidenceHashLostLuggage',      'under_review', NULL, '0x444aaa555bbb666ccc777ddd888eee999fff000aaa111bbb222ccc333ddd444e', DATE_SUB(NOW(), INTERVAL 1 DAY),  NULL,                              DATE_SUB(NOW(), INTERVAL 1 DAY),  NOW()),
(205, (SELECT id FROM policies WHERE chain_policy_id=105), '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', 0.45, 'QmX5evidenceHashFireDamage',       'paid',         NULL, '0x555aaa666bbb777ccc888ddd999eee000fff111aaa222bbb333ccc444ddd555e', DATE_SUB(NOW(), INTERVAL 40 DAY), DATE_SUB(NOW(), INTERVAL 35 DAY), DATE_SUB(NOW(), INTERVAL 40 DAY), NOW()),
(206, (SELECT id FROM policies WHERE chain_policy_id=105), '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', 0.20, 'QmX6evidenceHashWaterDamage',      'rejected',     'Thiet hai do bao khong thuoc pham vi bao hiem',  '0x666aaa777bbb888ccc999ddd000eee111fff222aaa333bbb444ccc555ddd666e', DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 8 DAY),  DATE_SUB(NOW(), INTERVAL 10 DAY), NOW()),
(207, (SELECT id FROM policies WHERE chain_policy_id=107), '0x90f79bf6eb2c4f870365e785982e1f101e93b906', 0.10, 'QmX7evidenceHashCollision',        'approved',     NULL, '0x777aaa888bbb999ccc000ddd111eee222fff333aaa444bbb555ccc666ddd777e', DATE_SUB(NOW(), INTERVAL 7 DAY),  DATE_SUB(NOW(), INTERVAL 4 DAY),  DATE_SUB(NOW(), INTERVAL 7 DAY),  NOW()),
(208, (SELECT id FROM policies WHERE chain_policy_id=108), '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65', 0.05, 'QmX8evidenceHashMedicalExam',      'needs_info',   NULL, '0x888aaa999bbb000ccc111ddd222eee333fff444aaa555bbb666ccc777ddd888e', DATE_SUB(NOW(), INTERVAL 3 DAY),  NULL,                              DATE_SUB(NOW(), INTERVAL 3 DAY),  NOW()),
(209, (SELECT id FROM policies WHERE chain_policy_id=101), '0x9d6ffe940a835113725232f795d7a18f8399dfcd', 0.03, 'QmX9evidenceHashMinorScratch',     'rejected',     'Thiet hai duoi muc toi thieu duoc boi thuong',   '0x999aaa000bbb111ccc222ddd333eee444fff555aaa666bbb777ccc888ddd999e', DATE_SUB(NOW(), INTERVAL 60 DAY), DATE_SUB(NOW(), INTERVAL 58 DAY), DATE_SUB(NOW(), INTERVAL 60 DAY), NOW()),
(210, (SELECT id FROM policies WHERE chain_policy_id=102), '0x9d6ffe940a835113725232f795d7a18f8399dfcd', 0.22, 'QmXAevidenceHashEmergencySurgery', 'paid',         NULL, '0xaaa111bbb222ccc333ddd444eee555fff666aaa777bbb888ccc999ddd000eeee', DATE_SUB(NOW(), INTERVAL 35 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 35 DAY), NOW());

SELECT 'users' AS t, COUNT(*) AS n FROM users
UNION SELECT 'policies', COUNT(*) FROM policies
UNION SELECT 'claims', COUNT(*) FROM claims;
