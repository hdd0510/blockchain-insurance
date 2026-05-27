const { ethers } = require('ethers');
const {
  policyContract,
  claimsContract,
  claimsContractReadOnly,
  hospitalContract,
  adminWallet,
  secondaryAdminWallet,
} = require('../config/blockchain');

// ---------------------------------------------------------------------------
// Policy contract helpers (unchanged from v1)
// ---------------------------------------------------------------------------

async function createPolicyOnChain(customerWallet, type, premiumEth, maxCoverageEth, days) {
  if (!policyContract) throw new Error('Policy contract not configured');

  const premiumWei = ethers.parseEther(String(premiumEth));
  const maxCoverageWei = ethers.parseEther(String(maxCoverageEth));
  const durationDays = BigInt(days);

  const documentHash = ethers.keccak256(
    ethers.toUtf8Bytes(`policy-${Date.now()}`)
  );

  const tx = await policyContract.createPolicy(
    customerWallet,
    type,
    premiumWei,
    maxCoverageWei,
    durationDays,
    documentHash
  );
  const receipt = await tx.wait();

  let policyId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = policyContract.interface.parseLog(log);
      if (parsed && parsed.name === 'PolicyCreated') {
        policyId = parsed.args.policyId.toString();
        break;
      }
    } catch {
      /* skip non-matching logs */
    }
  }
  return { txHash: receipt.hash, policyId };
}

async function cancelPolicyOnChain(chainPolicyId) {
  if (!policyContract) throw new Error('Policy contract not configured');
  const tx = await policyContract.cancelPolicy(BigInt(chainPolicyId));
  const receipt = await tx.wait();
  return receipt.hash;
}

// ---------------------------------------------------------------------------
// ClaimsProcessor v2 helpers
// ---------------------------------------------------------------------------

/**
 * Multi-sig approval (Section 2.3).
 * Each admin signer calls this once per claim. When the threshold is
 * reached, the contract internally requests oracle verification.
 *
 * If `useSecondarySigner` is true and the backend has PRIVATE_KEY_SIGNER_B
 * configured, the second admin signer signs instead — this lets the
 * backend simulate N-of-M from a single API call in the demo.
 */
async function signApprovalOnChain(chainClaimId, { useSecondarySigner = false } = {}) {
  if (!claimsContract) throw new Error('Claims contract not configured');

  const contractToUse =
    useSecondarySigner && secondaryAdminWallet
      ? claimsContract.connect(secondaryAdminWallet)
      : claimsContract;

  const tx = await contractToUse.signApproval(BigInt(chainClaimId));
  const receipt = await tx.wait();
  return receipt.hash;
}

async function rejectClaimOnChain(chainClaimId, reason) {
  if (!claimsContract) throw new Error('Claims contract not configured');
  const tx = await claimsContract.rejectClaim(BigInt(chainClaimId), reason || '');
  const receipt = await tx.wait();
  return receipt.hash;
}

async function fileAppealOnChain(chainClaimId, reason, customerSignerOrPrivate) {
  if (!claimsContract) throw new Error('Claims contract not configured');
  // Customer normally calls this from the frontend with their MetaMask key.
  // We keep a backend path for testing/admin recovery scenarios.
  const signer =
    typeof customerSignerOrPrivate === 'string'
      ? new ethers.Wallet(customerSignerOrPrivate, claimsContract.runner.provider)
      : customerSignerOrPrivate || claimsContract.runner;
  const tx = await claimsContract.connect(signer).fileAppeal(BigInt(chainClaimId), reason || '');
  const receipt = await tx.wait();
  return receipt.hash;
}

async function reviewAppealOnChain(chainClaimId, accept, { useSecondarySigner = false } = {}) {
  if (!claimsContract) throw new Error('Claims contract not configured');
  const contractToUse =
    useSecondarySigner && secondaryAdminWallet
      ? claimsContract.connect(secondaryAdminWallet)
      : claimsContract;
  const tx = await contractToUse.reviewAppeal(BigInt(chainClaimId), accept);
  const receipt = await tx.wait();
  return receipt.hash;
}

async function escalateExpiredClaimOnChain(chainClaimId) {
  if (!claimsContract) throw new Error('Claims contract not configured');
  const tx = await claimsContract.escalateExpiredClaim(BigInt(chainClaimId));
  const receipt = await tx.wait();
  return receipt.hash;
}

async function readClaimOnChain(chainClaimId) {
  const contract = claimsContractReadOnly || claimsContract;
  if (!contract) throw new Error('Claims contract not configured');
  return contract.getClaim(BigInt(chainClaimId));
}

async function readAppealOnChain(chainClaimId) {
  const contract = claimsContractReadOnly || claimsContract;
  if (!contract) throw new Error('Claims contract not configured');
  return contract.getAppeal(BigInt(chainClaimId));
}

async function readThreshold() {
  const contract = claimsContractReadOnly || claimsContract;
  if (!contract) return null;
  return Number(await contract.threshold());
}

async function readAdminSigners() {
  const contract = claimsContractReadOnly || claimsContract;
  if (!contract) return [];
  return contract.getAdminSigners();
}

async function getContractBalance() {
  if (!claimsContract) return '0';
  const balanceWei = await claimsContract.getContractBalance();
  return ethers.formatEther(balanceWei);
}

// ---------------------------------------------------------------------------
// Hospital registry helpers
// ---------------------------------------------------------------------------

async function registerHospitalOnChain(wallet, name, apiEndpoint) {
  if (!hospitalContract) throw new Error('Hospital contract not configured');
  const tx = await hospitalContract.registerHospital(wallet, name, apiEndpoint);
  const receipt = await tx.wait();
  return receipt.hash;
}

async function isActiveHospital(wallet) {
  if (!hospitalContract) return false;
  return hospitalContract.isActiveHospital(wallet);
}

module.exports = {
  // policy
  createPolicyOnChain,
  cancelPolicyOnChain,
  // claims v2
  signApprovalOnChain,
  rejectClaimOnChain,
  fileAppealOnChain,
  reviewAppealOnChain,
  escalateExpiredClaimOnChain,
  readClaimOnChain,
  readAppealOnChain,
  readThreshold,
  readAdminSigners,
  getContractBalance,
  // hospital
  registerHospitalOnChain,
  isActiveHospital,
};
