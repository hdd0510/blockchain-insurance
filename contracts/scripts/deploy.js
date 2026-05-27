const { ethers } = require("hardhat");

/**
 * Deploys the v2 stack:
 *   1. InsurancePolicy
 *   2. HospitalRegistry
 *   3. MockOracle (oracleNode = deployer by default; override with env)
 *   4. ClaimsProcessor (multi-sig N-of-M, references the three above)
 *
 * Also registers a sample hospital so the demo runs out of the box.
 *
 * Env knobs:
 *   ORACLE_NODE_ADDRESS       address of the off-chain oracle service signer
 *   ADMIN_SIGNERS_CSV         comma-separated extra admin signers
 *   APPROVAL_THRESHOLD        N-of-M threshold (default 2)
 *   CLAIM_TIMEOUT_SECONDS     auto-expire window (default 7 days)
 *   HOSPITAL_WALLET           wallet to register as the demo hospital
 *   HOSPITAL_NAME             display name
 *   HOSPITAL_API              base URL of mock hospital API
 *   SEED_ETH                  amount to seed the ClaimsProcessor (default 0.5)
 */
async function main() {
  const signers = await ethers.getSigners();
  const [deployer, signerB, signerC, hospitalDefault] = signers;

  console.log("Deploying with:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  // ------- 1. InsurancePolicy -------
  const Policy = await ethers.getContractFactory("InsurancePolicy");
  const policy = await Policy.deploy();
  await policy.waitForDeployment();
  const policyAddress = await policy.getAddress();
  console.log("InsurancePolicy deployed:", policyAddress);

  // ------- 2. HospitalRegistry -------
  const Hospital = await ethers.getContractFactory("HospitalRegistry");
  const hospital = await Hospital.deploy();
  await hospital.waitForDeployment();
  const hospitalAddress = await hospital.getAddress();
  console.log("HospitalRegistry deployed:", hospitalAddress);

  // ------- 3. MockOracle -------
  const oracleNode = process.env.ORACLE_NODE_ADDRESS || deployer.address;
  const Oracle = await ethers.getContractFactory("MockOracle");
  const oracle = await Oracle.deploy(oracleNode);
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("MockOracle deployed:", oracleAddress, "(node:", oracleNode + ")");

  // ------- 4. ClaimsProcessor -------
  const extraSignersCsv = (process.env.ADMIN_SIGNERS_CSV || "").trim();
  const extraSigners = extraSignersCsv
    ? extraSignersCsv.split(",").map((s) => s.trim()).filter(Boolean)
    : [
        signerB ? signerB.address : null,
        signerC ? signerC.address : null,
      ].filter(Boolean);

  const initialSigners = Array.from(new Set([deployer.address, ...extraSigners]));
  const threshold = parseInt(process.env.APPROVAL_THRESHOLD || "2", 10);
  const timeout = parseInt(process.env.CLAIM_TIMEOUT_SECONDS || `${7 * 24 * 60 * 60}`, 10);
  const seedEth = process.env.SEED_ETH || (process.env.NODE_ENV === "production" ? "0" : "1");

  const Claims = await ethers.getContractFactory("ClaimsProcessor");
  const claims = await Claims.deploy(
    policyAddress,
    oracleAddress,
    hospitalAddress,
    initialSigners,
    threshold,
    timeout,
    { value: ethers.parseEther(seedEth) }
  );
  await claims.waitForDeployment();
  const claimsAddress = await claims.getAddress();
  console.log("ClaimsProcessor deployed:", claimsAddress);
  console.log(
    "  signers:",
    initialSigners.join(","),
    "threshold:",
    threshold,
    "timeout:",
    timeout,
    "s"
  );
  console.log(
    "  ClaimsProcessor balance:",
    ethers.formatEther(await ethers.provider.getBalance(claimsAddress)),
    "ETH"
  );

  // ------- Seed demo hospital -------
  const demoHospitalWallet =
    process.env.HOSPITAL_WALLET || (hospitalDefault ? hospitalDefault.address : null);
  if (demoHospitalWallet) {
    const tx = await hospital.registerHospital(
      demoHospitalWallet,
      process.env.HOSPITAL_NAME || "Demo Hospital",
      process.env.HOSPITAL_API || "http://localhost:3001/api/hospital"
    );
    await tx.wait();
    console.log("Hospital registered:", demoHospitalWallet);
  }

  console.log("\n--- Add to backend/.env and frontend/.env ---");
  console.log(`CONTRACT_ADDRESS_POLICY=${policyAddress}`);
  console.log(`CONTRACT_ADDRESS_CLAIMS=${claimsAddress}`);
  console.log(`CONTRACT_ADDRESS_ORACLE=${oracleAddress}`);
  console.log(`CONTRACT_ADDRESS_HOSPITAL=${hospitalAddress}`);
  console.log(`ADMIN_WALLET=${deployer.address}`);
  console.log(`ORACLE_NODE_ADDRESS=${oracleNode}`);
  if (demoHospitalWallet) {
    console.log(`HOSPITAL_WALLET=${demoHospitalWallet}`);
  }
  if (initialSigners.length > 1) {
    console.log(`ADMIN_SIGNERS_CSV=${initialSigners.join(",")}`);
  }
  console.log(`APPROVAL_THRESHOLD=${threshold}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
