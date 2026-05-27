const { Claim, Policy, ClaimFile, Appeal, HospitalVerification } = require('../models');
const { logAction } = require('../services/audit-service');
const {
  rejectClaimOnChain,
  escalateExpiredClaimOnChain,
  readClaimOnChain,
  readThreshold,
  readAdminSigners,
} = require('../services/blockchain-service');
const { shouldUseManualSignerFlow } = require('../services/manual-admin-flow-service');

const VALID_STATUSES = [
  'pending',
  'under_review',
  'oracle_verified',
  'needs_info',
  'approved',
  'paid',
  'rejected',
  'appealed',
  'appeal_reviewing',
  'appeal_accepted',
  'appeal_rejected',
  'expired',
];

// Mirror on-chain enum (ClaimsProcessor.ClaimStatus) to MySQL string status.
const ON_CHAIN_STATUS_MAP = {
  0: 'pending',
  1: 'under_review',
  2: 'oracle_verified',
  3: 'needs_info',
  4: 'approved',
  5: 'paid',
  6: 'rejected',
  7: 'appealed',
  8: 'appeal_reviewing',
  9: 'appeal_accepted',
  10: 'appeal_rejected',
  11: 'expired',
};

async function listClaims(req, res) {
  if (req.user.role === 'hospital') {
    return res.status(403).json({ error: 'Hospital users cannot browse claim operations' });
  }

  const where =
    req.user.role === 'customer'
      ? { claimant_wallet: req.user.wallet.toLowerCase() }
      : {};

  const claims = await Claim.findAll({
    where,
    include: [{ association: 'policy' }],
    order: [['submitted_at', 'DESC']],
  });
  return res.json(claims);
}

async function createClaim(req, res) {
  const {
    policy_id,
    amount_eth,
    chain_claim_id,
    tx_hash,
    evidence_hash,
    patient_id_hash,
    hospital_wallet,
  } = req.body;

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

  const threshold = await readThreshold().catch(() => null);
  // Default 7-day timeout window (matches contract default).
  const timeoutAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const claim = await Claim.create({
    chain_claim_id: chain_claim_id || null,
    policy_id,
    claimant_wallet: req.user.wallet.toLowerCase(),
    amount_eth,
    evidence_hash: evidence_hash || null,
    tx_hash: tx_hash || null,
    status: 'pending',
    submitted_at: new Date(),
    patient_id_hash: patient_id_hash || null,
    hospital_wallet: hospital_wallet ? hospital_wallet.toLowerCase() : null,
    approvals_count: 0,
    threshold_required: threshold,
    timeout_at: timeoutAt,
  });

  await logAction(req, {
    action: 'claim.submit',
    entityType: 'claim',
    entityId: claim.id,
    newValue: {
      policy_id,
      amount_eth,
      evidence_hash,
      patient_id_hash,
      hospital_wallet,
      chain_claim_id,
    },
    txHash: tx_hash || null,
  });

  return res.status(201).json(claim);
}

async function getClaim(req, res) {
  const claim = await Claim.findByPk(req.params.id, {
    include: [
      { association: 'policy' },
      { association: 'files' },
      { association: 'appeal' },
      { association: 'verifications', include: [{ association: 'sourceRecord' }] },
    ],
  });
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  if (
    req.user.role === 'customer' &&
    claim.claimant_wallet !== req.user.wallet.toLowerCase()
  ) {
    return res.status(403).json({ error: 'Access denied' });
  }

  return res.json(claim);
}

/**
 * GET /api/claims/:id/chain
 * Reads the live on-chain state for a claim (multi-sig progress, oracle
 * status). Used by the frontend to power the "Approval x/N" progress bar.
 */
async function getClaimChainState(req, res) {
  const claim = await Claim.findByPk(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  if (!claim.chain_claim_id) {
    return res.json({ on_chain: false });
  }
  try {
    const [chain, threshold, signers] = await Promise.all([
      readClaimOnChain(claim.chain_claim_id),
      readThreshold(),
      readAdminSigners(),
    ]);
    return res.json({
      on_chain: true,
      threshold,
      admin_signers: signers,
      claim: {
        id: chain.id.toString(),
        policyId: chain.policyId.toString(),
        claimant: chain.claimant,
        amount: chain.amount.toString(),
        evidenceHash: chain.evidenceHash,
        patientId: chain.patientId,
        hospital: chain.hospital,
        status: Number(chain.status),
        statusLabel: ON_CHAIN_STATUS_MAP[Number(chain.status)],
        submittedAt: Number(chain.submittedAt),
        processedAt: Number(chain.processedAt),
        rejectReason: chain.rejectReason,
        oracleRequestId: chain.oracleRequestId.toString(),
        approvalsCount: Number(chain.approvalsCount),
        oracleVerified: chain.oracleVerified,
        oracleNote: chain.oracleNote,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Helper: mirror on-chain status -> MySQL status field. Best-effort; if
 * the contract is unreachable we keep the off-chain value.
 */
async function syncStatusFromChain(claim) {
  if (!claim.chain_claim_id) return claim;
  try {
    const chain = await readClaimOnChain(claim.chain_claim_id);
    const newStatus = ON_CHAIN_STATUS_MAP[Number(chain.status)];
    if (!newStatus) return claim;
    await claim.update({
      status: newStatus,
      approvals_count: Number(chain.approvalsCount),
      oracle_request_id: chain.oracleRequestId
        ? chain.oracleRequestId.toString()
        : null,
      oracle_verified:
        chain.oracleRequestId.toString() === '0' ? null : chain.oracleVerified,
      oracle_note: chain.oracleNote || null,
      reject_reason: chain.rejectReason || claim.reject_reason,
      processed_at:
        Number(chain.processedAt) > 0
          ? new Date(Number(chain.processedAt) * 1000)
          : claim.processed_at,
    });
  } catch (err) {
    console.warn(`[claim-controller] syncStatusFromChain failed: ${err.message}`);
  }
  return claim.reload();
}

/**
 * POST /api/claims/:id/sign  [insurer/admin]
 * Body: { use_secondary_signer?: bool }
 *
 * Multi-sig: each admin signer calls this once. The smart contract
 * automatically triggers oracle verification once `threshold` unique
 * signers have signed. The route mirrors the resulting status to MySQL.
 */
async function signApproval(req, res) {
  const { tx_hash } = req.body || {};
  const claim = await Claim.findByPk(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  if (!claim.chain_claim_id) {
    return res.status(400).json({ error: 'Claim has no on-chain id; cannot sign' });
  }
  if (['paid', 'rejected', 'appeal_rejected', 'expired'].includes(claim.status)) {
    return res.status(400).json({ error: `Claim already ${claim.status}` });
  }

  if (!shouldUseManualSignerFlow(req.body)) {
    return res.status(400).json({
      error: 'Manual MetaMask signing is required for admin multi-sig approvals',
    });
  }
  const txHash = tx_hash;

  await claim.update({ tx_hash: txHash });
  await syncStatusFromChain(claim);

  await logAction(req, {
    action: 'claim.approve.sign',
    entityType: 'claim',
    entityId: claim.id,
    oldValue: { approvals_count: claim.approvals_count - 1 },
    newValue: {
      approvals_count: claim.approvals_count,
      threshold_required: claim.threshold_required,
      signer_mode: 'wallet',
    },
    txHash,
  });

  return res.json(await claim.reload());
}

/**
 * PATCH /api/claims/:id/reject  [insurer/admin]
 * Manual reject (kept as escape hatch). Oracle-driven rejects happen
 * automatically when fulfillVerification returns false.
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

  const prevStatus = claim.status;
  await claim.update({
    status: 'rejected',
    reject_reason: reason || '',
    tx_hash: txHash,
    processed_at: new Date(),
  });

  await logAction(req, {
    action: 'claim.reject',
    entityType: 'claim',
    entityId: claim.id,
    oldValue: { status: prevStatus },
    newValue: { status: 'rejected', reason },
    txHash,
  });

  return res.json(claim);
}

/**
 * PATCH /api/claims/:id/status  [insurer/admin]
 * Generic status update used for workflow transitions like "needs_info".
 */
async function updateStatus(req, res) {
  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${VALID_STATUSES.join(', ')}`,
    });
  }

  const claim = await Claim.findByPk(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  const prevStatus = claim.status;
  const updates = { status };
  if (['approved', 'rejected', 'paid', 'appeal_rejected', 'expired'].includes(status)) {
    updates.processed_at = new Date();
  }

  await claim.update(updates);

  await logAction(req, {
    action: 'claim.status.update',
    entityType: 'claim',
    entityId: claim.id,
    oldValue: { status: prevStatus },
    newValue: { status },
  });

  return res.json(claim);
}

/**
 * POST /api/claims/:id/escalate  [admin or anyone]
 * Auto-expires a stuck claim past the timeout window (Section 2.5).
 */
async function escalateClaim(req, res) {
  const claim = await Claim.findByPk(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  let txHash = null;
  if (claim.chain_claim_id) {
    try {
      txHash = await escalateExpiredClaimOnChain(claim.chain_claim_id);
    } catch (err) {
      return res.status(400).json({ error: `Cannot escalate: ${err.message}` });
    }
  }

  await syncStatusFromChain(claim);
  await logAction(req, {
    action: 'claim.escalate.expire',
    entityType: 'claim',
    entityId: claim.id,
    newValue: { status: 'expired' },
    txHash,
  });

  return res.json(await claim.reload());
}

/**
 * POST /api/claims/:id/sync
 * Pulls the latest on-chain state into MySQL. Cheap fallback for the
 * frontend when it suspects drift (e.g. after a manual oracle fulfill).
 */
async function syncClaim(req, res) {
  const claim = await Claim.findByPk(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  await syncStatusFromChain(claim);
  return res.json(await claim.reload());
}

module.exports = {
  listClaims,
  createClaim,
  getClaim,
  getClaimChainState,
  signApproval,
  rejectClaim,
  updateStatus,
  escalateClaim,
  syncClaim,
};
