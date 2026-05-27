const {
  HospitalVerification,
  Claim,
  User,
  HospitalRecord,
} = require('../models');
const { logAction } = require('../services/audit-service');
const {
  registerHospitalOnChain,
  isActiveHospital,
} = require('../services/blockchain-service');
const { buildPendingVerificationDraft } = require('../services/hospital-workflow-service');
const { fulfillVerificationDecision } = require('../services/oracle-service');

/**
 * Hospital portal endpoints (Section 1.4 of v2 feedback).
 *
 *   - Hospital user (role='hospital') logs in via MetaMask just like a
 *     customer; their wallet must be registered both in MySQL and in the
 *     on-chain HospitalRegistry to verify claims.
 *
 *   - The off-chain oracle service POSTs to /api/hospital/verify when it
 *     needs an answer. The Hospital portal also lets a human operator
 *     answer manually if the automation cannot decide.
 *
 *   - All writes are mirrored to the audit log.
 */

/**
 * GET /api/hospital/verifications
 *   - admin: all rows
 *   - hospital: rows tied to their wallet
 *   - customer: 403
 */
async function listVerifications(req, res) {
  if (req.user.role === 'customer') {
    return res.status(403).json({ error: 'Access denied' });
  }
  const where = {};
  if (req.user.role === 'hospital') {
    where.hospital_wallet = req.user.wallet.toLowerCase();
  }
  const rows = await HospitalVerification.findAll({
    where,
    include: [{ association: 'claim' }, { association: 'sourceRecord' }],
    order: [['requested_at', 'DESC']],
  });
  return res.json(rows);
}

/**
 * GET /api/hospital/verifications/:id
 */
async function getVerification(req, res) {
  const row = await HospitalVerification.findByPk(req.params.id, {
    include: [{ association: 'claim' }, { association: 'sourceRecord' }],
  });
  if (!row) return res.status(404).json({ error: 'Verification not found' });
  if (
    req.user.role === 'hospital' &&
    String(row.hospital_wallet).toLowerCase() !== req.user.wallet.toLowerCase()
  ) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (req.user.role === 'customer') {
    return res.status(403).json({ error: 'Access denied' });
  }
  return res.json(row);
}

/**
 * POST /api/hospital/verify
 *   Local compatibility endpoint: returns the matching hospital record data
 *   instead of a random verdict. External demo hospital service mirrors this
 *   contract but runs on a separate port.
 *
 *   Body: { hospital_wallet, patient_id_hash, chain_claim_id?, oracle_request_id? }
 */
async function autoVerify(req, res) {
  // Optional shared secret check — protects oracle->hospital path.
  const expected = process.env.HOSPITAL_API_TOKEN;
  const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (expected && expected !== provided) {
    return res.status(401).json({ error: 'Invalid hospital API token' });
  }

  const { hospital_wallet, patient_id_hash, chain_claim_id, oracle_request_id } = req.body;
  if (!patient_id_hash || !/^0x[0-9a-fA-F]{64}$/.test(patient_id_hash)) {
    return res.status(400).json({ error: 'patient_id_hash (bytes32) is required' });
  }
  if (!hospital_wallet || !/^0x[0-9a-fA-F]{40}$/.test(hospital_wallet)) {
    return res.status(400).json({ error: 'hospital_wallet is required' });
  }

  const normalizedWallet = hospital_wallet.toLowerCase();
  const hUser = await User.findOne({
    where: { wallet_address: normalizedWallet },
  });
  const record = await HospitalRecord.findOne({
    where: {
      hospital_wallet: normalizedWallet,
      patient_id_hash,
    },
    order: [['updated_at', 'DESC']],
  });
  const draft = buildPendingVerificationDraft({
    hospitalWallet: normalizedWallet,
    patientIdHash: patient_id_hash,
    record,
  });

  return res.json({
    matched: !!record,
    note: draft.note,
    hospital_name: hUser?.hospital_name || hUser?.full_name || null,
    patient_id_hash,
    hospital_wallet: normalizedWallet,
    source_record_id: record?.id || null,
    record: record
      ? {
          id: record.id,
          patient_name: record.patient_name,
          record_number: record.record_number,
          diagnosis: record.diagnosis,
          treatment_date: record.treatment_date,
          discharge_date: record.discharge_date,
          claimable: record.claimable,
          coverage_amount_eth: record.coverage_amount_eth,
          note: record.note,
        }
      : null,
    chain_claim_id: chain_claim_id || null,
    oracle_request_id: oracle_request_id || null,
  });
}

/**
 * POST /api/hospital/verifications/:id/manual
 * Hospital user is the real verifier. Once they submit the verdict, the
 * backend/oracle key fulfills the on-chain request immediately.
 */
async function manualAnswer(req, res) {
  if (req.user.role !== 'hospital') {
    return res.status(403).json({ error: 'Only hospital users can submit manual answers' });
  }
  const { verified, note } = req.body;
  if (typeof verified !== 'boolean') {
    return res.status(400).json({ error: 'verified (boolean) is required' });
  }

  const row = await HospitalVerification.findByPk(req.params.id, {
    include: [{ association: 'sourceRecord' }],
  });
  if (!row) return res.status(404).json({ error: 'Verification not found' });
  if (String(row.hospital_wallet).toLowerCase() !== req.user.wallet.toLowerCase()) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (row.status === 'fulfilled') {
    return res.status(400).json({ error: 'Verification already fulfilled on-chain' });
  }

  const finalNote =
    note ||
    (verified
      ? `Verified manually by hospital against record ${row.sourceRecord?.record_number || 'N/A'}`
      : 'Rejected manually by hospital after record review');
  const prev = { result: row.result, status: row.status, note: row.note };

  await fulfillVerificationDecision(row, {
    verified,
    note: finalNote,
    reviewerWallet: req.user.wallet.toLowerCase(),
  });

  await logAction(req, {
    action: 'hospital.verification.manual',
    entityType: 'hospital_verification',
    entityId: row.id,
    oldValue: prev,
    newValue: { result: verified ? 'verified' : 'not_verified', status: 'fulfilled', note: finalNote },
  });

  return res.json(await row.reload({ include: [{ association: 'sourceRecord' }] }));
}

/**
 * POST /api/hospital/register  [admin]
 * Body: { wallet, name, api_endpoint, role_user? }
 * Registers a hospital both in MySQL (as a user with role=hospital) and
 * in the on-chain HospitalRegistry.
 */
async function registerHospital(req, res) {
  const { wallet, name, api_endpoint } = req.body;
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet' });
  }
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  // On-chain register
  let txHash = null;
  try {
    txHash = await registerHospitalOnChain(wallet, name, api_endpoint || '');
  } catch (err) {
    if (!/already registered/i.test(err.message)) {
      return res.status(500).json({ error: `On-chain register failed: ${err.message}` });
    }
  }

  // Off-chain user record
  const normalized = wallet.toLowerCase();
  let user = await User.findOne({ where: { wallet_address: normalized } });
  if (!user) {
    user = await User.create({
      wallet_address: normalized,
      full_name: name,
      role: 'hospital',
      hospital_name: name,
    });
  } else {
    await user.update({ role: 'hospital', hospital_name: name });
  }

  await logAction(req, {
    action: 'hospital.register',
    entityType: 'user',
    entityId: user.id,
    newValue: { wallet: normalized, name, api_endpoint, role: 'hospital' },
    txHash,
  });

  return res.json({ user, tx_hash: txHash });
}

/**
 * GET /api/hospital/registry/:wallet
 * Returns whether the wallet is an active hospital on-chain.
 */
async function getRegistryStatus(req, res) {
  const { wallet } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet' });
  }
  const active = await isActiveHospital(wallet).catch(() => false);
  return res.json({ wallet, active });
}

async function listHospitalCatalog(_req, res) {
  const users = await User.findAll({
    where: { role: 'hospital' },
    attributes: ['wallet_address', 'full_name', 'hospital_name'],
    order: [['hospital_name', 'ASC']],
  });
  return res.json(
    users.map((u) => ({
      wallet: u.wallet_address,
      name: u.hospital_name || u.full_name || u.wallet_address,
    }))
  );
}

module.exports = {
  listVerifications,
  getVerification,
  autoVerify,
  manualAnswer,
  registerHospital,
  getRegistryStatus,
  listHospitalCatalog,
};
