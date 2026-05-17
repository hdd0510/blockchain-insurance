import { ethers } from "ethers";
import InsurancePolicyABI from "../contracts/InsurancePolicy.json";
import ClaimsProcessorABI from "../contracts/ClaimsProcessor.json";

const POLICY_ADDRESS = process.env.REACT_APP_POLICY_CONTRACT;
const CLAIMS_ADDRESS = process.env.REACT_APP_CLAIMS_CONTRACT;

/**
 * Get read-only contract instances using BrowserProvider.
 * Requires MetaMask to be connected.
 */
export async function getContracts() {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const provider = new ethers.BrowserProvider(window.ethereum);

  const policyContract = new ethers.Contract(
    POLICY_ADDRESS,
    InsurancePolicyABI.abi,
    provider
  );

  const claimsContract = new ethers.Contract(
    CLAIMS_ADDRESS,
    ClaimsProcessorABI.abi,
    provider
  );

  return { provider, policyContract, claimsContract };
}

/**
 * Get signer-backed contract instances for write operations.
 */
export async function getSignedContracts(provider) {
  const signer = await provider.getSigner();

  const policyContract = new ethers.Contract(
    POLICY_ADDRESS,
    InsurancePolicyABI.abi,
    signer
  );

  const claimsContract = new ethers.Contract(
    CLAIMS_ADDRESS,
    ClaimsProcessorABI.abi,
    signer
  );

  return { signer, policyContract, claimsContract };
}

/**
 * Check if a policy ID is currently valid on-chain.
 */
export async function isPolicyValid(policyId) {
  const { policyContract } = await getContracts();
  return await policyContract.isValid(policyId);
}

/**
 * Fetch full policy data from chain by ID.
 */
export async function getPolicyOnChain(policyId) {
  const { policyContract } = await getContracts();
  return await policyContract.getPolicy(policyId);
}

/**
 * Fetch full claim data from chain by ID.
 */
export async function getClaimOnChain(claimId) {
  const { claimsContract } = await getContracts();
  return await claimsContract.getClaim(claimId);
}
