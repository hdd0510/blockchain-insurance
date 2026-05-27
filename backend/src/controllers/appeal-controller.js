const { Appeal, Claim, User } = require('../models');
const { logAction } = require('../services/audit-service');
const {
  readAppealOnChain,
} = require('../services/blockchain-service');
const { shouldUseManualSignerFlow } = require('../services/manual-admin-flow-service');

/**
 * Appeal flow (Section 2.4 of v2 feedback).
 *
 * Lifecycle:
 *   rejected claim
 *     -> POST /appeals       (customer, mirrors on-chain fileAppeal)
 *     -> claim status becomes 'appealed'
 *     -> admin signers POST /appeals/:claimId/review  with accept|reject
 *     -> threshold votes flip to 'appeal_accepted' (re-runs oracle) or
 *        'appeal_rejected' (final).
 *
 * The frontend calls fileAppeal on the smart contract directly with the
 * customer's MetaMask key; this endpoint records the off-chain mirror.
 */

/**
 * POST /api/appeals
 * Body: { claim_id, reason, tx_hash? }
 * Records the appeal in MySQL after the customer filed it on-chain.
 */
async function fileAppeal(req, res) {
  const { claim_id, reason, tx_hash } = req.body;
  if (!claim_id || !reason) {
    return res.status(400).json({ error: 'claim_id and reason are required' });
  }

  const claim = await Claim.findByPk(claim_id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  if (claim.claimant_wallet !== req.user.wallet.toLowerCase()) {
    return res.status(403).json({ error: 'Only the claimant can appeal' });
  }
  if (claim.status !== 'rejected') {
    return res.status(400).json({ error: `Cannot appeal a claim in status '${claim.status}'` });
  }

  const existing = await Appeal.findOne({ where: { claim_id } });
  if (existing) {
    return res.status(400).json({ error: 'Appeal already filed for this claim' });
  }

  const appeal = await Appeal.create({
    claim_id: claim.id,
    chain_claim_id: claim.chain_claim_id,
    appellant_wallet: req.user.wallet.toLowerCase(),
    reason,
    status: 'filed',
    tx_hash_filed: tx_hash || null,
  });

  const prevStatus = claim.status;
  await claim.update({ status: 'appealed' });

  await logAction(req, {
    action: 'appeal.file',
    entityType: 'appeal',
    entityId: appeal.id,
    oldValue: { claim_status: prevStatus },
    newValue: { claim_status: 'appealed', reason },
    txHash: tx_hash || null,
  });

  return res.status(201).json(appeal);
}

/**
 * GET /api/appeals
 * Admin signer: all appeals. Customer: only their own. Hospital: none.
 */
async function listAppeals(req, res) {
  let where = {};
  if (req.user.role === 'customer') {
    where = { appellant_wallet: req.user.wallet.toLowerCase() };
  } else if (req.user.role === 'hospital') {
    return res.json([]);
  }

  const appeals = await Appeal.findAll({
    where,
    include: [{ association: 'claim' }],
    order: [['filed_at', 'DESC']],
  });
  return res.json(appeals);
}

/**
 * GET /api/appeals/:claimId
 */
async function getAppealByClaim(req, res) {
  const appeal = await Appeal.findOne({
    where: { claim_id: req.params.claimId },
    include: [{ association: 'claim' }],
  });
  if (!appeal) return res.status(404).json({ error: 'Appeal not found' });

  if (
    req.user.role === 'customer' &&
    appeal.appellant_wallet !== req.user.wallet.toLowerCase()
  ) {
    return res.status(403).json({ error: 'Access denied' });
  }
  return res.json(appeal);
}

/**
 * POST /api/appeals/:claimId/review  [admin]
 * Body: { accept: bool, use_secondary_signer?: bool, note?: string }
 *
 * Casts an admin-signer vote on-chain via the backend admin wallet (or the
 * optional secondary signer). When threshold is reached the on-chain
 * contract auto-resolves; we mirror the resulting status into MySQL.
 */
async function reviewAppeal(req, res) {
  const { accept, note, tx_hash } = req.body;
  if (typeof accept !== 'boolean') {
    return res.status(400).json({ error: 'accept (boolean) is required' });
  }

  const appeal = await Appeal.findOne({
    where: { claim_id: req.params.claimId },
    include: [{ association: 'claim' }],
  });
  if (!appeal) return res.status(404).json({ error: 'Appeal not found' });
  if (appeal.status === 'accepted' || appeal.status === 'rejected') {
    return res.status(400).json({ error: `Appeal already ${appeal.status}` });
  }

  const claim = appeal.claim;
  if (!claim) {
    return res.status(500).json({ error: 'Linked claim missing' });
  }

  // On-chain vote
  if (!shouldUseManualSignerFlow(req.body)) {
    return res.status(400).json({
      error: 'Manual MetaMask signing is required for appeal review multi-sig',
    });
  }
  const txHash = tx_hash;

  // Mirror current state from on-chain into MySQL.
  let onChainAppeal = null;
  if (claim.chain_claim_id) {
    try {
      onChainAppeal = await readAppealOnChain(claim.chain_claim_id);
    } catch {
      /* ignore */
    }
  }

  // Append reviewer wallet
  const reviewers = Array.isArray(appeal.reviewed_by_wallets)
    ? [...appeal.reviewed_by_wallets]
    : [];
  reviewers.push({
    wallet: req.user.wallet.toLowerCase(),
    accept,
    note: note || null,
    at: new Date().toISOString(),
    tx_hash: txHash,
  });

  let newStatus = appeal.status === 'filed' ? 'reviewing' : appeal.status;
  let claimNewStatus = claim.status;
  let resolvedAt = null;

  if (onChainAppeal && onChainAppeal.resolved) {
    if (onChainAppeal.accepted) {
      newStatus = 'accepted';
      claimNewStatus = 'appeal_accepted';
    } else {
      newStatus = 'rejected';
      claimNewStatus = 'appeal_rejected';
    }
    resolvedAt = new Date();
  } else if (!onChainAppeal) {
    // No on-chain mirror: best-effort flip when threshold votes recorded off-chain.
    newStatus = 'reviewing';
  }

  await appeal.update({
    status: newStatus,
    reviewed_by_wallets: reviewers,
    tx_hash_resolved: resolvedAt ? txHash : appeal.tx_hash_resolved,
    resolution_note: note || appeal.resolution_note,
    resolved_at: resolvedAt,
  });

  if (claimNewStatus !== claim.status) {
    await claim.update({ status: claimNewStatus });
  }

  await logAction(req, {
    action: `appeal.review.${accept ? 'accept' : 'reject'}`,
    entityType: 'appeal',
    entityId: appeal.id,
    oldValue: { status: appeal.status, claim_status: claim.status },
    newValue: {
      status: newStatus,
      claim_status: claimNewStatus,
      note,
      signer_mode: 'wallet',
    },
    txHash,
  });

  return res.json({ appeal: await appeal.reload(), claim: await claim.reload() });
}

module.exports = { fileAppeal, listAppeals, getAppealByClaim, reviewAppeal };
