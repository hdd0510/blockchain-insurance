import { ethers } from "ethers";
import InsurancePolicyABI from "../contracts/InsurancePolicy.json";
import ClaimsProcessorABI from "../contracts/ClaimsProcessor.json";
import MockOracleABI from "../contracts/MockOracle.json";
import HospitalRegistryABI from "../contracts/HospitalRegistry.json";

const POLICY_ADDRESS = process.env.REACT_APP_POLICY_CONTRACT;
const CLAIMS_ADDRESS = process.env.REACT_APP_CLAIMS_CONTRACT;
const ORACLE_ADDRESS = process.env.REACT_APP_ORACLE_CONTRACT;
const HOSPITAL_ADDRESS = process.env.REACT_APP_HOSPITAL_CONTRACT;

function maybeContract(address, abi, runner) {
  return address ? new ethers.Contract(address, abi, runner) : null;
}

export async function getContracts() {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const provider = new ethers.BrowserProvider(window.ethereum);
  return {
    provider,
    policyContract: maybeContract(POLICY_ADDRESS, InsurancePolicyABI.abi, provider),
    claimsContract: maybeContract(CLAIMS_ADDRESS, ClaimsProcessorABI.abi, provider),
    oracleContract: maybeContract(ORACLE_ADDRESS, MockOracleABI.abi, provider),
    hospitalContract: maybeContract(HOSPITAL_ADDRESS, HospitalRegistryABI.abi, provider),
  };
}

export async function getSignedContracts(provider) {
  const signer = await provider.getSigner();
  return {
    signer,
    policyContract: maybeContract(POLICY_ADDRESS, InsurancePolicyABI.abi, signer),
    claimsContract: maybeContract(CLAIMS_ADDRESS, ClaimsProcessorABI.abi, signer),
    oracleContract: maybeContract(ORACLE_ADDRESS, MockOracleABI.abi, signer),
    hospitalContract: maybeContract(HOSPITAL_ADDRESS, HospitalRegistryABI.abi, signer),
  };
}

export async function isPolicyValid(policyId) {
  const { policyContract } = await getContracts();
  if (!policyContract) throw new Error("Policy contract not configured");
  return policyContract.isValid(policyId);
}

export async function getPolicyOnChain(policyId) {
  const { policyContract } = await getContracts();
  if (!policyContract) throw new Error("Policy contract not configured");
  return policyContract.getPolicy(policyId);
}

export async function getClaimOnChain(claimId) {
  const { claimsContract } = await getContracts();
  if (!claimsContract) throw new Error("Claims contract not configured");
  return claimsContract.getClaim(claimId);
}

export async function getClaimsThreshold() {
  const { claimsContract } = await getContracts();
  if (!claimsContract) return null;
  return Number(await claimsContract.threshold());
}

export async function signClaimApprovalWithWallet(provider, claimId) {
  const { claimsContract } = await getSignedContracts(provider);
  if (!claimsContract) throw new Error("Claims contract not configured");
  const tx = await claimsContract.signApproval(ethers.toBigInt(claimId));
  return tx.wait();
}

export async function reviewAppealWithWallet(provider, claimId, accept) {
  const { claimsContract } = await getSignedContracts(provider);
  if (!claimsContract) throw new Error("Claims contract not configured");
  const tx = await claimsContract.reviewAppeal(ethers.toBigInt(claimId), accept);
  return tx.wait();
}

/**
 * Compute the keccak256 of a UTF-8 string (used to hash patient ids before
 * submitting a claim on-chain).
 */
export function hashPatientId(text) {
  return ethers.keccak256(ethers.toUtf8Bytes(text || ""));
}
