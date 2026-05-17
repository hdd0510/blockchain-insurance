const { Policy, Claim } = require('../models');
const { createPolicyOnChain, cancelPolicyOnChain } = require('../services/blockchain-service');

/**
 * GET /policies
 * Admin: all policies. Customer: own policies filtered by wallet.
 */
async function listPolicies(req, res) {
  const where = req.user.role === 'customer'
    ? { customer_wallet: req.user.wallet.toLowerCase() }
    : {};

  const policies = await Policy.findAll({
    where,
    order: [['created_at', 'DESC']],
  });

  return res.json(policies);
}

/**
 * POST /policies  [admin only]
 * Body: { customer_wallet, policy_type, premium_eth, max_coverage_eth, duration_days }
 * Creates policy on-chain then saves to MySQL.
 */
async function createPolicy(req, res) {
  const { customer_wallet, policy_type, premium_eth, max_coverage_eth, duration_days } = req.body;

  if (!customer_wallet || !policy_type || !premium_eth || !max_coverage_eth || !duration_days) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(customer_wallet)) {
    return res.status(400).json({ error: 'Invalid customer_wallet address' });
  }

  const days = parseInt(duration_days, 10);
  if (isNaN(days) || days <= 0) {
    return res.status(400).json({ error: 'duration_days must be a positive integer' });
  }

  let txHash = null;
  let chainPolicyId = null;

  // Attempt on-chain creation; if contract not configured, save off-chain only
  try {
    const result = await createPolicyOnChain(
      customer_wallet,
      policy_type,
      premium_eth,
      max_coverage_eth,
      days
    );
    txHash = result.txHash;
    chainPolicyId = result.policyId;
  } catch (err) {
    console.warn('On-chain policy creation skipped:', err.message);
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const policy = await Policy.create({
    chain_policy_id: chainPolicyId,
    customer_wallet: customer_wallet.toLowerCase(),
    policy_type,
    premium_eth,
    max_coverage_eth,
    start_date: startDate,
    end_date: endDate,
    status: 'active',
    tx_hash: txHash,
  });

  return res.status(201).json(policy);
}

/**
 * GET /policies/:id
 */
async function getPolicy(req, res) {
  const policy = await Policy.findByPk(req.params.id, {
    include: [{ association: 'claims' }],
  });
  if (!policy) return res.status(404).json({ error: 'Policy not found' });

  // Customers can only view their own policies
  if (req.user.role === 'customer' &&
      policy.customer_wallet !== req.user.wallet.toLowerCase()) {
    return res.status(403).json({ error: 'Access denied' });
  }

  return res.json(policy);
}

/**
 * PATCH /policies/:id/cancel  [admin only]
 */
async function cancelPolicy(req, res) {
  const policy = await Policy.findByPk(req.params.id);
  if (!policy) return res.status(404).json({ error: 'Policy not found' });
  if (policy.status === 'cancelled') {
    return res.status(400).json({ error: 'Policy already cancelled' });
  }

  let txHash = policy.tx_hash;

  if (policy.chain_policy_id) {
    try {
      txHash = await cancelPolicyOnChain(policy.chain_policy_id);
    } catch (err) {
      console.warn('On-chain cancel skipped:', err.message);
    }
  }

  await policy.update({ status: 'cancelled', tx_hash: txHash });
  return res.json(policy);
}

module.exports = { listPolicies, createPolicy, getPolicy, cancelPolicy };
