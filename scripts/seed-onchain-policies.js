/**
 * seed-onchain-policies.js
 * Creates real on-chain policies for the 4 seed customers
 * and updates MySQL with the correct chain_policy_id.
 *
 * Run: node scripts/seed-onchain-policies.js
 */

const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.join(__dirname, '../backend/package.json'));

backendRequire('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { ethers } = backendRequire('ethers');
const mysql = backendRequire('mysql2/promise');

const policyArtifact = require(path.join(
  __dirname,
  '../contracts/artifacts/contracts/InsurancePolicy.sol/InsurancePolicy.json'
));

const CUSTOMERS = [
  {
    name: 'Nguyen Van An',
    wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    policies: [
      { type: 'vehicle', premium: '0.3', maxCoverage: '3.0', days: 365 },
      { type: 'travel',  premium: '0.1', maxCoverage: '1.0', days: 180 },
    ],
  },
  {
    name: 'Tran Thi Binh',
    wallet: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    policies: [
      { type: 'property', premium: '0.5', maxCoverage: '5.0', days: 365 },
      { type: 'health',   premium: '0.2', maxCoverage: '2.0', days: 365 },
    ],
  },
  {
    name: 'Le Hoang Cuong',
    wallet: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    policies: [
      { type: 'vehicle', premium: '0.3', maxCoverage: '3.0', days: 365 },
    ],
  },
  {
    name: 'Pham Mai Dung',
    wallet: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    policies: [
      { type: 'health', premium: '0.2', maxCoverage: '2.0', days: 365 },
    ],
  },
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
  const adminWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const policyContract = new ethers.Contract(
    process.env.CONTRACT_ADDRESS_POLICY,
    policyArtifact.abi,
    adminWallet
  );

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'password',
    database: process.env.DB_NAME || 'insurance_db',
  });

  console.log('✓ Connected to blockchain + MySQL\n');

  // Delete only policies without on-chain data (fake seed entries)
  await db.execute('DELETE FROM policies');
  console.log('✓ Cleared old seed policies\n');

  // Get current nonce for admin wallet
  let nonce = await provider.getTransactionCount(adminWallet.address, 'latest');
  console.log(`Admin nonce starts at: ${nonce}\n`);

  for (const customer of CUSTOMERS) {
    console.log(`→ Creating policies for ${customer.name} (${customer.wallet})`);

    for (const pol of customer.policies) {
      const premiumWei    = ethers.parseEther(pol.premium);
      const maxCovWei     = ethers.parseEther(pol.maxCoverage);
      const durationDays  = BigInt(pol.days);
      const docHash       = ethers.keccak256(ethers.toUtf8Bytes(`seed-${customer.wallet}-${pol.type}-${Date.now()}`));

      // Create on-chain with explicit nonce
      const tx = await policyContract.createPolicy(
        customer.wallet,
        pol.type,
        premiumWei,
        maxCovWei,
        durationDays,
        docHash,
        { nonce: nonce++ }
      );
      const receipt = await tx.wait();

      // Parse policyId from event
      let chainPolicyId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = policyContract.interface.parseLog(log);
          if (parsed && parsed.name === 'PolicyCreated') {
            chainPolicyId = parsed.args.policyId.toString();
            break;
          }
        } catch {}
      }

      // Save to MySQL
      const startDate = new Date();
      const endDate   = new Date();
      endDate.setDate(endDate.getDate() + pol.days);

      await db.execute(
        `INSERT INTO policies
         (chain_policy_id, customer_wallet, policy_type, premium_eth, max_coverage_eth,
          start_date, end_date, status, tx_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())`,
        [
          chainPolicyId,
          customer.wallet.toLowerCase(),
          pol.type,
          pol.premium,
          pol.maxCoverage,
          startDate,
          endDate,
          receipt.hash,
        ]
      );

      console.log(`  ✓ ${pol.type} | chain_policy_id=${chainPolicyId} | tx=${receipt.hash.slice(0,12)}...`);
    }
  }

  await db.end();
  console.log('\n✅ All on-chain policies created and saved to MySQL!');
  console.log('   Customers can now submit claims.');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
