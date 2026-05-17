import api from "./api";

/**
 * Login with MetaMask wallet:
 * 1. Fetch nonce from backend
 * 2. Sign message with wallet
 * 3. Send signature to backend for JWT
 */
export async function loginWithWallet(provider, account) {
  const { data: { nonce } } = await api.get(`/auth/nonce?wallet=${account}`);
  const signer = await provider.getSigner();
  const signature = await signer.signMessage(`Sign in to Insurance App: ${nonce}`);
  const { data } = await api.post("/auth/login", { wallet: account, signature });
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data.user;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}
