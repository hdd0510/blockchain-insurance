const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Deploy InsurancePolicy
  const Policy = await ethers.getContractFactory("InsurancePolicy");
  const policy = await Policy.deploy();
  await policy.waitForDeployment();
  const policyAddress = await policy.getAddress();
  console.log("InsurancePolicy deployed:", policyAddress);

  // Deploy ClaimsProcessor (seed with 0.5 ETH for payouts on local, 0 on testnet)
  const seedEth = process.env.NODE_ENV === "production" ? "0" : "0.5";
  const Claims = await ethers.getContractFactory("ClaimsProcessor");
  const claims = await Claims.deploy(policyAddress, {
    value: ethers.parseEther(seedEth),
  });
  await claims.waitForDeployment();
  const claimsAddress = await claims.getAddress();
  console.log("ClaimsProcessor deployed:", claimsAddress);
  console.log("ClaimsProcessor balance:", ethers.formatEther(await ethers.provider.getBalance(claimsAddress)), "ETH");

  console.log("\n--- Add to backend/.env and frontend/.env ---");
  console.log(`CONTRACT_ADDRESS_POLICY=${policyAddress}`);
  console.log(`CONTRACT_ADDRESS_CLAIMS=${claimsAddress}`);
  console.log(`ADMIN_WALLET=${deployer.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
