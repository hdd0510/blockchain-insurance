import api from "./api";

export async function listClaims() {
  const { data } = await api.get("/claims");
  return data;
}

export async function getClaim(id) {
  const { data } = await api.get(`/claims/${id}`);
  return data;
}

export async function getClaimChainState(id) {
  const { data } = await api.get(`/claims/${id}/chain`);
  return data;
}

export async function signApproval(id, useSecondarySigner = false, txHash = null) {
  const { data } = await api.post(`/claims/${id}/sign`, {
    use_secondary_signer: useSecondarySigner,
    tx_hash: txHash,
  });
  return data;
}

export async function rejectClaim(id, reason) {
  const { data } = await api.patch(`/claims/${id}/reject`, { reason });
  return data;
}

export async function updateStatus(id, status) {
  const { data } = await api.patch(`/claims/${id}/status`, { status });
  return data;
}

export async function syncClaim(id) {
  const { data } = await api.post(`/claims/${id}/sync`);
  return data;
}

export async function escalateClaim(id) {
  const { data } = await api.post(`/claims/${id}/escalate`);
  return data;
}
