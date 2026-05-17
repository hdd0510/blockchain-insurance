const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config();

// Load ABIs from compiled artifacts
const policyArtifact = require(path.join(
  __dirname,
  '../../../contracts/artifacts/contracts/InsurancePolicy.sol/InsurancePolicy.json'
));
const claimsArtifact = require(path.join(
  __dirname,
  '../../../contracts/artifacts/contracts/ClaimsProcessor.sol/ClaimsProcessor.json'
));

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');

// Admin wallet funded with ETH on local chain
const adminWallet = process.env.PRIVATE_KEY
  ? new ethers.Wallet(process.env.PRIVATE_KEY, provider)
  : null;

// Contract instances (read-only if no admin wallet)
const policyContract = process.env.CONTRACT_ADDRESS_POLICY
  ? new ethers.Contract(
      process.env.CONTRACT_ADDRESS_POLICY,
      policyArtifact.abi,
      adminWallet || provider
    )
  : null;

const claimsContract = process.env.CONTRACT_ADDRESS_CLAIMS
  ? new ethers.Contract(
      process.env.CONTRACT_ADDRESS_CLAIMS,
      claimsArtifact.abi,
      adminWallet || provider
    )
  : null;

module.exports = { provider, adminWallet, policyContract, claimsContract };
