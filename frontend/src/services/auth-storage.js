/**
 * Per-tab auth persistence via sessionStorage.
 * Each browser tab keeps its own JWT/user so logout in one tab does not affect others.
 */

const TOKEN_KEY = "token";
const USER_KEY = "user";

/** One-time: move legacy localStorage session into this tab's sessionStorage. */
function migrateLegacyAuthOnce() {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(TOKEN_KEY)) return;

  const legacyToken = localStorage.getItem(TOKEN_KEY);
  if (!legacyToken) return;

  sessionStorage.setItem(TOKEN_KEY, legacyToken);
  const legacyUser = localStorage.getItem(USER_KEY);
  if (legacyUser) sessionStorage.setItem(USER_KEY, legacyUser);

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken() {
  migrateLegacyAuthOnce();
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUserRaw() {
  migrateLegacyAuthOnce();
  return sessionStorage.getItem(USER_KEY);
}

export function setStoredUser(user) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.removeItem(USER_KEY);
}

export function clearAuth() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
