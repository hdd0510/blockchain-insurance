import React, { createContext, useContext, useState, useCallback } from "react";
import { useWallet } from "../hooks/use-wallet";
import { loginWithWallet, logout as authLogout, getStoredUser } from "../services/auth-service";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { account, provider, connect: connectWallet } = useWallet();
  const [user, setUser] = useState(() => getStoredUser());

  // isAdmin derived from stored user role
  const isAdmin = user?.role === "admin";

  /**
   * Connect MetaMask then authenticate with backend.
   * Returns user object on success, null on failure.
   */
  const connect = useCallback(async () => {
    try {
      const result = await connectWallet();
      if (!result) return null;
      const loggedUser = await loginWithWallet(result.provider, result.account);
      setUser(loggedUser);
      return loggedUser;
    } catch (err) {
      console.error("Auth connect error:", err);
      return null;
    }
  }, [connectWallet]);

  const logout = useCallback(() => {
    authLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, isAdmin, account, provider, connect, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
