import api from "./api";

export async function listVerifications() {
  const { data } = await api.get("/hospital/verifications");
  return data;
}

export async function getVerification(id) {
  const { data } = await api.get(`/hospital/verifications/${id}`);
  return data;
}

/**
 * Hospital user manually overrides the auto-verdict on a single verification
 * request. This does NOT push to the oracle — admins still need to retrigger
 * the oracle if they want this to flow to the contract.
 */
export async function submitManualAnswer(id, { verified, note }) {
  const { data } = await api.post(`/hospital/verifications/${id}/manual`, {
    verified,
    note,
  });
  return data;
}

export async function registerHospital({ wallet, name, api_endpoint }) {
  const { data } = await api.post("/hospital/register", {
    wallet,
    name,
    api_endpoint,
  });
  return data;
}

export async function getRegistryStatus(wallet) {
  const { data } = await api.get(`/hospital/registry/${wallet}`);
  return data;
}
