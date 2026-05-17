const { ethers } = require('ethers');
const { policyContract, claimsContract, provider } = require('../config/blockchain');

/**
 * Create a policy on-chain via admin wallet.
 * Returns { txHash, policyId } where policyId is the uint256 from PolicyCreated event.
 */
async function createPolicyOnChain(customerWallet, type, premiumEth, maxCoverageEth, days) {
  if (!policyContract) throw new Error('Policy contract not configured');

  const premiumWei = ethers.parseEther(String(premiumEth));
  const maxCoverageWei = ethers.parseEther(String(maxCoverageEth));
  const durationDays = BigInt(days);

  // Unique document hash: keccak256 of "policy-{timestamp}"
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

  // Parse PolicyCreated(policyId, customer, policyType) event
  let policyId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = policyContract.interface.parseLog(log);
      if (parsed && parsed.name === 'PolicyCreated') {
        policyId = parsed.args.policyId.toString();
        break;
      }
    } catch {
      // Skip non-matching logs
    }
  }

  return { txHash: receipt.hash, policyId };
}

/**
 * Cancel a policy on-chain via admin wallet.
 * Returns txHash.
 */
async function cancelPolicyOnChain(chainPolicyId) {
  if (!policyContract) throw new Error('Policy contract not configured');

  const tx = await policyContract.cancelPolicy(BigInt(chainPolicyId));
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Approve a claim on-chain via admin wallet.
 * Returns txHash.
 */
async function approveClaimOnChain(chainClaimId) {
  if (!claimsContract) throw new Error('Claims contract not configured');

  const tx = await claimsContract.approveClaim(BigInt(chainClaimId));
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Reject a claim on-chain via admin wallet.
 * Returns txHash.
 */
async function rejectClaimOnChain(chainClaimId, reason) {
  if (!claimsContract) throw new Error('Claims contract not configured');

  const tx = await claimsContract.rejectClaim(BigInt(chainClaimId), reason || '');
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Get contract ETH balance as human-readable string.
 */
async function getContractBalance() {
  if (!claimsContract) return '0';

  const balanceWei = await claimsContract.getContractBalance();
  return ethers.formatEther(balanceWei);
}

module.exports = {
  createPolicyOnChain,
  cancelPolicyOnChain,
  approveClaimOnChain,
  rejectClaimOnChain,
  getContractBalance,
};
