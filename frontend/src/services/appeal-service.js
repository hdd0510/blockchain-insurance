import api from "./api";

// List appeals visible to the current user (own for customers, all for admins).
export async function listAppeals() {
  const { data } = await api.get("/appeals");
  return data;
}

export async function getAppealByClaim(claimId) {
  const { data } = await api.get(`/appeals/${claimId}`);
  return data;
}

/**
 * Persist a freshly filed appeal in MySQL after the customer ran
 * `fileAppeal` on the contract via MetaMask. The backend mirrors the
 * status into the claims table and writes an audit log row.
 */
export async function fileAppeal({ claim_id, reason, tx_hash }) {
  const { data } = await api.post("/appeals", { claim_id, reason, tx_hash });
  return data;
}

/**
 * Admin signer review. accept=true/false maps to the on-chain
 * reviewAppeal(claimId, accept). Backend calls the contract for us.
 */
export async function reviewAppeal(claimId, { accept, note, use_secondary_signer = false, tx_hash = null }) {
  const { data } = await api.post(`/appeals/${claimId}/review`, {
    accept,
    note,
    use_secondary_signer,
    tx_hash,
  });
  return data;
}
