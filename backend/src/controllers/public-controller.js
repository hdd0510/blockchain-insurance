const { Claim, Policy } = require('../models');
const sequelize = require('../config/database');

/**
 * Anonymize wallet to 0x1234...abcd format for public view.
 */
function shortWallet(addr) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * GET /api/public/transactions
 * Public on-chain transaction explorer. No auth required.
 * Returns all claims with anonymized wallets + policy type.
 */
async function listPublicTransactions(req, res) {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  const claims = await Claim.findAll({
    limit,
    order: [['submitted_at', 'DESC']],
    include: [{ association: 'policy', attributes: ['policy_type', 'chain_policy_id'] }],
  });

  const transactions = claims.map((c) => ({
    id: c.id,
    chain_claim_id: c.chain_claim_id,
    policy_type: c.policy?.policy_type,
    chain_policy_id: c.policy?.chain_policy_id,
    claimant: shortWallet(c.claimant_wallet),
    amount_eth: c.amount_eth,
    status: c.status,
    tx_hash: c.tx_hash,
    evidence_hash: c.evidence_hash,
    submitted_at: c.submitted_at,
    processed_at: c.processed_at,
  }));

  return res.json({ count: transactions.length, transactions });
}

/**
 * GET /api/public/stats
 * Aggregated KPIs across the whole system. No auth required.
 */
async function getStats(req, res) {
  const [policyCount, activePolicyCount, claimCount, paidSum, pendingCount, totalCoverage] = await Promise.all([
    Policy.count(),
    Policy.count({ where: { status: 'active' } }),
    Claim.count(),
    Claim.sum('amount_eth', { where: { status: 'paid' } }),
    Claim.count({ where: { status: ['pending', 'under_review', 'needs_info'] } }),
    Policy.sum('max_coverage_eth', { where: { status: 'active' } }),
  ]);

  const claimsByStatus = await Claim.findAll({
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['status'],
    raw: true,
  });

  return res.json({
    policies: { total: policyCount, active: activePolicyCount },
    claims: { total: claimCount, pending: pendingCount, by_status: claimsByStatus },
    payouts_eth: paidSum || 0,
    total_coverage_eth: totalCoverage || 0,
  });
}

module.exports = { listPublicTransactions, getStats };
