function buildPendingVerificationDraft({ hospitalWallet, patientIdHash, record }) {
  if (!hospitalWallet || !patientIdHash) {
    throw new Error('hospitalWallet and patientIdHash are required');
  }

  if (!record) {
    return {
      result: 'pending',
      status: 'pending_manual',
      source_record_id: null,
      note:
        'No matching hospital record was found in the demo database. Awaiting hospital manual review.',
    };
  }

  const eligibility = record.claimable ? 'Eligible' : 'Not eligible';
  const fragments = [
    `Matched hospital record ${record.record_number} for ${record.patient_name}.`,
    record.diagnosis ? `Diagnosis: ${record.diagnosis}.` : null,
    record.coverage_amount_eth
      ? `Coverage cap: ${record.coverage_amount_eth} ETH.`
      : null,
    `${eligibility} for claim processing.`,
    record.note || null,
  ].filter(Boolean);

  return {
    result: 'pending',
    status: 'pending_manual',
    source_record_id: record.id,
    note: fragments.join(' '),
  };
}

function buildManualFulfillmentPayload({ verification, verdict, reviewerWallet }) {
  if (!verification?.oracle_request_id) {
    throw new Error('verification.oracle_request_id is required');
  }
  if (typeof verdict?.verified !== 'boolean') {
    throw new Error('verdict.verified must be boolean');
  }

  return {
    oracle: {
      requestId: Number(verification.oracle_request_id),
      verified: verdict.verified,
      note: verdict.note || '',
    },
    row: {
      result: verdict.verified ? 'verified' : 'not_verified',
      status: 'fulfilled',
      note: verdict.note || '',
      reviewed_by_wallet: reviewerWallet || null,
      manual_reviewed_at: new Date(),
      verified_at: new Date(),
    },
  };
}

module.exports = {
  buildPendingVerificationDraft,
  buildManualFulfillmentPayload,
};
