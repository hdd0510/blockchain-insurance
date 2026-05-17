const { Claim, Policy, ClaimFile } = require('../models');
const { approveClaimOnChain, rejectClaimOnChain } = require('../services/blockchain-service');

const VALID_STATUSES = ['pending', 'under_review', 'needs_info', 'approved', 'rejected', 'paid'];

/**
 * GET /claims
 * Admin: all claims. Customer: own claims filtered by wallet.
 */
async function listClaims(req, res) {
  const where = req.user.role === 'customer'
    ? { claimant_wallet: req.user.wallet.toLowerCase() }
    : {};

  const claims = await Claim.findAll({
    where,
    include: [{ association: 'policy' }],
    order: [['submitted_at', 'DESC']],
  });

  return res.json(claims);
}

/**
 * POST /claims  [customer]
 * Body: { policy_id, amount_eth, chain_claim_id, tx_hash, evidence_hash }
 * Frontend submits on-chain first, then registers the result here.
 */
async function createClaim(req, res) {
  const { policy_id, amount_eth, chain_claim_id, tx_hash, evidence_hash } = req.body;

  if (!policy_id || !amount_eth) {
    return res.status(400).json({ error: 'policy_id and amount_eth are required' });
  }

  const policy = await Policy.findByPk(policy_id);
  if (!policy) return res.status(404).json({ error: 'Policy not found' });

  if (policy.customer_wallet !== req.user.wallet.toLowerCase()) {
    return res.status(403).json({ error: 'You can only claim on your own policies' });
  }

  if (policy.status !== 'active') {
    return res.status(400).json({ error: 'Policy is not active' });
  }

  const claim = await Claim.create({
    chain_claim_id: chain_claim_id || null,
    policy_id,
    claimant_wallet: req.user.wallet.toLowerCase(),
    amount_eth,
    evidence_hash: evidence_hash || null,
    tx_hash: tx_hash || null,
    status: 'pending',
    submitted_at: new Date(),
  });

  return res.status(201).json(claim);
}

/**
 * GET /claims/:id
 * Includes attached files. Customers can only view own claims.
 */
async function getClaim(req, res) {
  const claim = await Claim.findByPk(req.params.id, {
    include: [
      { association: 'policy' },
      { association: 'files' },
    ],
  });
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  if (req.user.role === 'customer' &&
      claim.claimant_wallet !== req.user.wallet.toLowerCase()) {
    return res.status(403).json({ error: 'Access denied' });
  }

  return res.json(claim);
}

/**
 * PATCH /claims/:id/approve  [admin]
 * Calls approveClaimOnChain then updates MySQL status.
 */
async function approveClaim(req, res) {
  const claim = await Claim.findByPk(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  if (claim.status === 'approved' || claim.status === 'paid') {
    return res.status(400).json({ error: `Claim already ${claim.status}` });
  }

  let txHash = claim.tx_hash;

  if (claim.chain_claim_id) {
    try {
      txHash = await approveClaimOnChain(claim.chain_claim_id);
    } catch (err) {
      console.warn('On-chain approve skipped:', err.message);
    }
  }

  await claim.update({
    status: 'approved',
    tx_hash: txHash,
    processed_at: new Date(),
  });

  return res.json(claim);
}

/**
 * PATCH /claims/:id/reject  [admin]
 * Body: { reason }
 */
async function rejectClaim(req, res) {
  const { reason } = req.body;
  const claim = await Claim.findByPk(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  if (claim.status === 'rejected') {
    return res.status(400).json({ error: 'Claim already rejected' });
  }

  let txHash = claim.tx_hash;

  if (claim.chain_claim_id) {
    try {
      txHash = await rejectClaimOnChain(claim.chain_claim_id, reason || '');
    } catch (err) {
      console.warn('On-chain reject skipped:', err.message);
    }
  }

  await claim.update({
    status: 'rejected',
    reject_reason: reason || '',
    tx_hash: txHash,
    processed_at: new Date(),
  });

  return res.json(claim);
}

/**
 * PATCH /claims/:id/status  [admin]
 * Body: { status }
 * Generic status update for workflow transitions (e.g. under_review, needs_info, paid).
 */
async function updateStatus(req, res) {
  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const claim = await Claim.findByPk(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  const updates = { status };
  if (['approved', 'rejected', 'paid'].includes(status)) {
    updates.processed_at = new Date();
  }

  await claim.update(updates);
  return res.json(claim);
}

module.exports = { listClaims, createClaim, getClaim, approveClaim, rejectClaim, updateStatus };
