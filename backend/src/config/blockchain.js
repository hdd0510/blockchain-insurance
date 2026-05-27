const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config();

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

const ARTIFACTS_DIR = path.join(__dirname, '../../../contracts/artifacts/contracts');

function loadArtifact(file) {
  return require(path.join(ARTIFACTS_DIR, file));
}

const policyArtifact = loadArtifact('InsurancePolicy.sol/InsurancePolicy.json');
const claimsArtifact = loadArtifact('ClaimsProcessor.sol/ClaimsProcessor.json');
const oracleArtifact = loadArtifact('MockOracle.sol/MockOracle.json');
const hospitalArtifact = loadArtifact('HospitalRegistry.sol/HospitalRegistry.json');

// ---------------------------------------------------------------------------
// Provider + wallets
// ---------------------------------------------------------------------------

const provider = new ethers.JsonRpcProvider(
  process.env.RPC_URL || 'http://127.0.0.1:8545'
);

// Primary admin wallet (used for onlyAdmin contract calls).
const adminWallet = process.env.PRIVATE_KEY
  ? new ethers.Wallet(process.env.PRIVATE_KEY, provider)
  : null;

// Optional second admin signer for multi-sig demos (e.g. signing claim approvals
// from the backend without forcing the operator to switch MetaMask accounts).
const secondaryAdminWallet = process.env.PRIVATE_KEY_SIGNER_B
  ? new ethers.Wallet(process.env.PRIVATE_KEY_SIGNER_B, provider)
  : null;

// Off-chain oracle node — only this key may call MockOracle.fulfillVerification.
const oracleNodeWallet = process.env.ORACLE_NODE_PRIVATE_KEY
  ? new ethers.Wallet(process.env.ORACLE_NODE_PRIVATE_KEY, provider)
  : null;

// ---------------------------------------------------------------------------
// Contract instances
// ---------------------------------------------------------------------------

function buildContract(address, abi, signerOrProvider) {
  return address ? new ethers.Contract(address, abi, signerOrProvider) : null;
}

const policyContract = buildContract(
  process.env.CONTRACT_ADDRESS_POLICY,
  policyArtifact.abi,
  adminWallet || provider
);

const claimsContract = buildContract(
  process.env.CONTRACT_ADDRESS_CLAIMS,
  claimsArtifact.abi,
  adminWallet || provider
);

// Read-only view of claims for non-admin callers (e.g. customers reading
// approval counts via the backend) — wired through the bare provider so the
// admin signature never accidentally lands on user-initiated reads.
const claimsContractReadOnly = buildContract(
  process.env.CONTRACT_ADDRESS_CLAIMS,
  claimsArtifact.abi,
  provider
);

const oracleContract = buildContract(
  process.env.CONTRACT_ADDRESS_ORACLE,
  oracleArtifact.abi,
  adminWallet || provider
);

// Oracle contract bound to the oracle node key (only this can call fulfill).
const oracleContractAsNode = buildContract(
  process.env.CONTRACT_ADDRESS_ORACLE,
  oracleArtifact.abi,
  oracleNodeWallet || provider
);

const hospitalContract = buildContract(
  process.env.CONTRACT_ADDRESS_HOSPITAL,
  hospitalArtifact.abi,
  adminWallet || provider
);

module.exports = {
  provider,
  adminWallet,
  secondaryAdminWallet,
  oracleNodeWallet,
  policyContract,
  claimsContract,
  claimsContractReadOnly,
  oracleContract,
  oracleContractAsNode,
  hospitalContract,
};
