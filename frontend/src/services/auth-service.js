import api from "./api";
import { clearAuth, getStoredUserRaw, setStoredUser, setToken } from "./auth-storage";

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
  setToken(data.token);
  setStoredUser(data.user);
  return data.user;
}

export function logout() {
  clearAuth();
}

export function getStoredUser() {
  try {
    const raw = getStoredUserRaw();
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
