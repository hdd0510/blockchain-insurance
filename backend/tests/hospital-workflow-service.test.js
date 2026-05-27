const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPendingVerificationDraft,
  buildManualFulfillmentPayload,
} = require('../src/services/hospital-workflow-service');

test('buildPendingVerificationDraft uses matched hospital record and keeps request pending manual', () => {
  const draft = buildPendingVerificationDraft({
    hospitalWallet: '0xabc',
    patientIdHash: '0x123',
    record: {
      id: 11,
      patient_name: 'Nguyen Van A',
      record_number: 'HS-001',
      diagnosis: 'Fracture',
      claimable: true,
      coverage_amount_eth: '0.80',
      note: 'Eligible for inpatient claim',
    },
  });

  assert.equal(draft.status, 'pending_manual');
  assert.equal(draft.result, 'pending');
  assert.equal(draft.source_record_id, 11);
  assert.match(draft.note, /HS-001/);
  assert.match(draft.note, /Eligible/);
});

test('buildPendingVerificationDraft handles missing hospital record without random verdict', () => {
  const draft = buildPendingVerificationDraft({
    hospitalWallet: '0xabc',
    patientIdHash: '0x123',
    record: null,
  });

  assert.equal(draft.status, 'pending_manual');
  assert.equal(draft.result, 'pending');
  assert.equal(draft.source_record_id, null);
  assert.match(draft.note, /No matching hospital record/i);
});

test('buildManualFulfillmentPayload returns verified oracle payload after hospital review', () => {
  const payload = buildManualFulfillmentPayload({
    verification: {
      id: 5,
      oracle_request_id: 9,
      hospital_wallet: '0xabc',
      source_record_id: 11,
    },
    verdict: {
      verified: true,
      note: 'Verified against hospital record HS-001',
    },
    reviewerWallet: '0xreviewer',
  });

  assert.equal(payload.oracle.verified, true);
  assert.equal(payload.oracle.requestId, 9);
  assert.match(payload.oracle.note, /HS-001/);
  assert.equal(payload.row.status, 'fulfilled');
  assert.equal(payload.row.result, 'verified');
  assert.equal(payload.row.reviewed_by_wallet, '0xreviewer');
});

test('buildManualFulfillmentPayload returns not_verified payload after hospital rejection', () => {
  const payload = buildManualFulfillmentPayload({
    verification: {
      id: 5,
      oracle_request_id: 9,
      hospital_wallet: '0xabc',
      source_record_id: null,
    },
    verdict: {
      verified: false,
      note: 'No supported inpatient record found',
    },
    reviewerWallet: '0xreviewer',
  });

  assert.equal(payload.oracle.verified, false);
  assert.equal(payload.oracle.requestId, 9);
  assert.equal(payload.row.result, 'not_verified');
  assert.equal(payload.row.status, 'fulfilled');
});
