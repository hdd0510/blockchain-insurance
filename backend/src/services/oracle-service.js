/* eslint-disable no-console */
/**
 * Oracle service daemon (Section 2.2 of the v2 feedback).
 *
 * Architecture:
 *
 *   ClaimsProcessor                 MockOracle                 Hospital API
 *        │  signApproval (N-of-M)       │                           │
 *        │  ─── requestVerification ──▶ │                           │
 *        │                              │ emits                     │
 *        │                              │ VerificationRequested     │
 *        │                              │                           │
 *        │                              ▼                           │
 *        │                      ┌──────────────┐                    │
 *        │                      │ oracle-service│  GET /verify      │
 *        │                      │  (this file) │ ────────────────▶ │
 *        │                      │              │  { verified }      │
 *        │                      │              │ ◀───────────────── │
 *        │                      └─────┬────────┘                    │
 *        │                            │                             │
 *        │                            │ fulfillVerification         │
 *        │  ◀─────── fulfill ─────────│  (only oracle node key)     │
 *        │                                                          │
 *        ▼ payout or auto-reject                                    │
 *
 * Standalone runner: `node src/services/oracle-service.js` (started by
 * `scripts/start-all.sh`). Can also be imported and `start()`-ed from
 * tests.
 */

require('dotenv').config();
const axios = require('axios');
const { ethers } = require('ethers');

const {
  provider,
  oracleContract,
  oracleContractAsNode,
  oracleNodeWallet,
} = require('../config/blockchain');

const { HospitalVerification, Claim } = require('../models');
const sequelize = require('../config/database');
const {
  buildPendingVerificationDraft,
  buildManualFulfillmentPayload,
} = require('./hospital-workflow-service');

const HOSPITAL_API_BASE =
  process.env.HOSPITAL_API_BASE || 'http://localhost:3001/api/hospital';
const HOSPITAL_API_TOKEN = process.env.HOSPITAL_API_TOKEN || '';

const POLL_FROM_BLOCK =
  process.env.ORACLE_POLL_FROM_BLOCK
    ? parseInt(process.env.ORACLE_POLL_FROM_BLOCK, 10)
    : null; // null => only future events

function logPrefix() {
  return `[oracle-service ${new Date().toISOString()}]`;
}

/**
 * Call the external hospital service to look up the patient record.
 * The result is used to enrich the pending request, but the verdict still
 * waits for a real hospital user to confirm it manually.
 */
async function askHospital({ hospitalWallet, patientIdHash, claimId, oracleRequestId }) {
  const url = `${HOSPITAL_API_BASE}/records/match`;
  try {
    const res = await axios.post(
      url,
      {
        hospital_wallet: hospitalWallet,
        patient_id_hash: patientIdHash,
        chain_claim_id: claimId,
        oracle_request_id: oracleRequestId,
      },
      {
        timeout: 8000,
        headers: HOSPITAL_API_TOKEN
          ? { Authorization: `Bearer ${HOSPITAL_API_TOKEN}` }
          : {},
      }
    );
    return {
      matched: !!res.data?.matched,
      note: String(res.data?.note || '').slice(0, 256),
      record: res.data?.record || null,
    };
  } catch (err) {
    console.warn(
      `${logPrefix()} Hospital API lookup failed (${err.message}); creating manual review request without record match.`
    );
    return {
      matched: false,
      note: 'Hospital service unavailable during record lookup. Manual review required.',
      record: null,
    };
  }
}

async function recordRequest(event, draft) {
  const { requestId, claimId, patientId, hospital, consumer } = event.args;
  const requestIdNum = requestId.toString();
  const normalizedHospital = String(hospital).toLowerCase();

  console.log(
    `${logPrefix()} VerificationRequested id=${requestIdNum} claimId=${claimId} hospital=${hospital}`
  );

  // Find the matching MySQL claim record (best-effort: by chain_claim_id).
  let claimRow = null;
  try {
    claimRow = await Claim.findOne({ where: { chain_claim_id: claimId.toString() } });
  } catch (err) {
    console.warn(`${logPrefix()} claim lookup failed: ${err.message}`);
  }

  let row = await HospitalVerification.findOne({
    where: { oracle_request_id: requestIdNum },
  });
  if (!row) {
    row = await HospitalVerification.create({
      claim_id: claimRow?.id || null,
      chain_claim_id: claimId.toString(),
      oracle_request_id: requestIdNum,
      hospital_wallet: normalizedHospital,
      patient_id_hash: patientId,
      result: draft.result,
      status: draft.status,
      note: draft.note,
      source_record_id: draft.source_record_id,
    });
  }
  return row;
}

async function fulfillOnChain(requestId, verified, note) {
  if (!oracleContractAsNode || !oracleNodeWallet) {
    throw new Error(
      'oracle-service: ORACLE_NODE_PRIVATE_KEY must be set in backend/.env'
    );
  }
  const tx = await oracleContractAsNode.fulfillVerification(
    BigInt(requestId),
    verified,
    note || ''
  );
  const receipt = await tx.wait();
  return receipt.hash;
}

async function handleRequest(event) {
  const requestId = event.args.requestId.toString();
  const match = await askHospital({
    hospitalWallet: event.args.hospital,
    patientIdHash: event.args.patientId,
    claimId: event.args.claimId.toString(),
    oracleRequestId: requestId,
  });
  const draft = buildPendingVerificationDraft({
    hospitalWallet: event.args.hospital,
    patientIdHash: event.args.patientId,
    record: match.record,
  });
  if (match.note && !draft.note.includes(match.note)) {
    draft.note = `${draft.note} ${match.note}`.trim();
  }

  const row = await recordRequest(event, draft);
  if (row.status === 'fulfilled') {
    console.log(`${logPrefix()} request ${requestId} already fulfilled, skipping.`);
    return;
  }

  console.log(
    `${logPrefix()} requestId=${requestId} recorded as pending_manual; awaiting hospital decision`
  );
}

async function fulfillVerificationDecision(rowOrId, { verified, note, reviewerWallet }) {
  const row =
    typeof rowOrId === 'object'
      ? rowOrId
      : await HospitalVerification.findByPk(rowOrId);
  if (!row) throw new Error('Verification row not found');
  if (row.status === 'fulfilled') {
    throw new Error('Verification already fulfilled');
  }

  const payload = buildManualFulfillmentPayload({
    verification: row,
    verdict: { verified, note },
    reviewerWallet,
  });

  try {
    const txHash = await fulfillOnChain(
      payload.oracle.requestId,
      payload.oracle.verified,
      payload.oracle.note
    );
    await row.update({
      ...payload.row,
      oracle_tx_hash: txHash,
    });
    return txHash;
  } catch (err) {
    await row.update({
      status: 'fulfill_failed',
      note: `${payload.oracle.note} | fulfill failed: ${err.message}`.trim(),
    });
    throw err;
  }
}

let started = false;

async function start() {
  if (!oracleContract) {
    console.error(
      `${logPrefix()} CONTRACT_ADDRESS_ORACLE not set — oracle-service will not run.`
    );
    return;
  }
  if (!oracleNodeWallet) {
    console.warn(
      `${logPrefix()} ORACLE_NODE_PRIVATE_KEY not set — oracle cannot fulfill on-chain. Set it in backend/.env.`
    );
  }
  if (started) return;
  started = true;

  // Catch up on requests emitted before this process started.
  if (POLL_FROM_BLOCK != null) {
    try {
      const filter = oracleContract.filters.VerificationRequested();
      const past = await oracleContract.queryFilter(filter, POLL_FROM_BLOCK);
      for (const ev of past) {
        await handleRequest(ev).catch((e) =>
          console.error(`${logPrefix()} backfill error: ${e.message}`)
        );
      }
    } catch (err) {
      console.warn(`${logPrefix()} backfill skipped: ${err.message}`);
    }
  }

  oracleContract.on(
    'VerificationRequested',
    async (requestId, claimId, patientId, hospital, consumer, event) => {
      // ethers v6 listener delivers args + an event object.
      try {
        await handleRequest({
          args: { requestId, claimId, patientId, hospital, consumer },
          log: event,
        });
      } catch (err) {
        console.error(`${logPrefix()} handler error: ${err.message}`);
      }
    }
  );

  const block = await provider.getBlockNumber();
  console.log(
    `${logPrefix()} started. listening from block ${block} on ${oracleContract.target}`
  );
}

async function stop() {
  if (!oracleContract) return;
  oracleContract.removeAllListeners('VerificationRequested');
  started = false;
}

// Standalone entry point
if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await sequelize.sync({ alter: false });
      await start();
    } catch (err) {
      console.error(`${logPrefix()} startup failed: ${err.message}`);
      process.exit(1);
    }
  })();
}

module.exports = { start, stop, handleRequest, fulfillVerificationDecision };
