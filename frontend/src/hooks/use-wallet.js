import { useState, useEffect } from "react";
import { ethers } from "ethers";

/**
 * Hook to manage MetaMask wallet connection.
 * Handles account/chain change events automatically.
 */
export function useWallet() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);

  async function connect() {
    if (!window.ethereum) {
      alert("Vui lòng cài MetaMask!");
      return null;
    }
    try {
      // Revoke prior permission then request again → MetaMask opens single-page
      // account picker without the extra "Confirm permissions" step.
      // Fallback: ignore revoke errors (older MM versions lack the method).
      try {
        await window.ethereum.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // ignored
      }
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (!accounts || accounts.length === 0) return null;
      const p = new ethers.BrowserProvider(window.ethereum);
      setAccount(accounts[0]);
      setProvider(p);
      return { account: accounts[0], provider: p };
    } catch (err) {
      console.error("Wallet connect error:", err);
      return null;
    }
  }

  useEffect(() => {
    // Restore previously connected account on mount
    if (window.ethereum) {
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setProvider(new ethers.BrowserProvider(window.ethereum));
          }
        })
        .catch(console.error);

      const handleAccountsChanged = (accounts) => {
        setAccount(accounts[0] || null);
        if (!accounts[0]) setProvider(null);
      };

      const handleChainChanged = () => window.location.reload();

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, []);

  return { account, provider, connect };
}
