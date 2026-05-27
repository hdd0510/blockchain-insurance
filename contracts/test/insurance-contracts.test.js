const { expect } = require("chai");
const { ethers } = require("hardhat");

const POLICY_TYPE = "health";
const ZERO_BYTES32 = "0x" + "0".repeat(64);

const SEED = ethers.parseEther("2");
const CLAIM_AMOUNT = ethers.parseEther("0.3");
const EVIDENCE = ethers.keccak256(ethers.toUtf8Bytes("evidence"));
const PATIENT = ethers.keccak256(ethers.toUtf8Bytes("patient-123"));

// ---------------------------------------------------------------------------
// InsurancePolicy
// ---------------------------------------------------------------------------

describe("InsurancePolicy", () => {
  let policy, admin, customer, other;

  beforeEach(async () => {
    [admin, customer, other] = await ethers.getSigners();
    const Policy = await ethers.getContractFactory("InsurancePolicy");
    policy = await Policy.deploy();
  });

  const createTestPolicy = () =>
    policy.connect(admin).createPolicy(
      customer.address,
      POLICY_TYPE,
      ethers.parseEther("0.01"),
      ethers.parseEther("1"),
      365,
      ethers.keccak256(ethers.toUtf8Bytes("doc"))
    );

  it("admin can create a policy", async () => {
    await expect(createTestPolicy())
      .to.emit(policy, "PolicyCreated")
      .withArgs(1, customer.address, POLICY_TYPE);

    const p = await policy.getPolicy(1);
    expect(p.customer).to.equal(customer.address);
    expect(p.maxCoverage).to.equal(ethers.parseEther("1"));
  });

  it("non-admin cannot create a policy", async () => {
    await expect(
      policy.connect(other).createPolicy(
        customer.address,
        POLICY_TYPE,
        ethers.parseEther("0.01"),
        ethers.parseEther("1"),
        365,
        ethers.keccak256(ethers.toUtf8Bytes("doc"))
      )
    ).to.be.revertedWith("Not admin");
  });

  it("isValid + cancel work", async () => {
    await createTestPolicy();
    expect(await policy.isValid(1)).to.equal(true);
    await policy.connect(admin).cancelPolicy(1);
    expect(await policy.isValid(1)).to.equal(false);
  });
});

// ---------------------------------------------------------------------------
// HospitalRegistry
// ---------------------------------------------------------------------------

describe("HospitalRegistry", () => {
  let registry, admin, hospital, other;

  beforeEach(async () => {
    [admin, hospital, other] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("HospitalRegistry");
    registry = await Registry.deploy();
  });

  it("admin can register and update hospitals", async () => {
    await expect(
      registry
        .connect(admin)
        .registerHospital(hospital.address, "Demo", "http://localhost/api")
    )
      .to.emit(registry, "HospitalRegistered")
      .withArgs(hospital.address, "Demo", "http://localhost/api");

    expect(await registry.isActiveHospital(hospital.address)).to.equal(true);

    await registry
      .connect(admin)
      .updateHospital(hospital.address, "Demo 2", "http://x", false);
    expect(await registry.isActiveHospital(hospital.address)).to.equal(false);
  });

  it("non-admin cannot register", async () => {
    await expect(
      registry.connect(other).registerHospital(hospital.address, "X", "u")
    ).to.be.revertedWith("Hospital: not admin");
  });
});

// ---------------------------------------------------------------------------
// MockOracle
// ---------------------------------------------------------------------------

describe("MockOracle", () => {
  let oracle, admin, node, hospital, otherSigner;

  beforeEach(async () => {
    [admin, node, hospital, otherSigner] = await ethers.getSigners();
    const Oracle = await ethers.getContractFactory("MockOracle");
    oracle = await Oracle.deploy(node.address);
  });

  it("emits VerificationRequested with monotonic ids", async () => {
    await expect(
      oracle
        .connect(otherSigner)
        .requestVerification(42, PATIENT, hospital.address)
    )
      .to.emit(oracle, "VerificationRequested")
      .withArgs(1, 42, PATIENT, hospital.address, otherSigner.address);
    expect(await oracle.requestCount()).to.equal(1);
  });

  it("rejects non-oracle node on fulfill", async () => {
    await oracle
      .connect(otherSigner)
      .requestVerification(42, PATIENT, hospital.address);
    await expect(
      oracle.connect(admin).fulfillVerification(1, true, "ok")
    ).to.be.revertedWith("Oracle: not oracle node");
  });

  it("admin can rotate oracle node", async () => {
    await expect(oracle.connect(admin).setOracleNode(otherSigner.address))
      .to.emit(oracle, "OracleNodeUpdated")
      .withArgs(node.address, otherSigner.address);
    expect(await oracle.oracleNode()).to.equal(otherSigner.address);
  });
});

// ---------------------------------------------------------------------------
// ClaimsProcessor v2 — multi-sig + Oracle + appeal + timeout
// ---------------------------------------------------------------------------

describe("ClaimsProcessor v2", () => {
  let policy, oracle, registry, claims;
  let admin, signerB, signerC, customer, hospital, node, outsider;

  const setupBase = async () => {
    [admin, signerB, signerC, customer, hospital, node, outsider] =
      await ethers.getSigners();

    const Policy = await ethers.getContractFactory("InsurancePolicy");
    policy = await Policy.deploy();

    const Registry = await ethers.getContractFactory("HospitalRegistry");
    registry = await Registry.deploy();

    const Oracle = await ethers.getContractFactory("MockOracle");
    oracle = await Oracle.deploy(node.address);

    const Claims = await ethers.getContractFactory("ClaimsProcessor");
    claims = await Claims.deploy(
      await policy.getAddress(),
      await oracle.getAddress(),
      await registry.getAddress(),
      [admin.address, signerB.address, signerC.address],
      2, // 2-of-3
      7 * 24 * 60 * 60, // 7 days timeout
      { value: SEED }
    );

    // Register hospital + create policy
    await registry
      .connect(admin)
      .registerHospital(hospital.address, "Demo", "http://localhost");
    await policy
      .connect(admin)
      .createPolicy(
        customer.address,
        POLICY_TYPE,
        ethers.parseEther("0.01"),
        ethers.parseEther("1"),
        365,
        ethers.keccak256(ethers.toUtf8Bytes("doc"))
      );
  };

  beforeEach(setupBase);

  const submitClaim = () =>
    claims
      .connect(customer)
      .submitClaim(1, CLAIM_AMOUNT, EVIDENCE, PATIENT, hospital.address);

  it("customer submits a claim and it stays Pending", async () => {
    await expect(submitClaim()).to.emit(claims, "ClaimSubmitted");
    const c = await claims.getClaim(1);
    expect(c.status).to.equal(0); // Pending
    expect(c.amount).to.equal(CLAIM_AMOUNT);
  });

  it("submitClaim rejects non-active hospital", async () => {
    await registry.connect(admin).deactivateHospital(hospital.address);
    await expect(submitClaim()).to.be.revertedWith("Claims: hospital not active");
  });

  it("requires threshold signatures before oracle request", async () => {
    await submitClaim();

    await expect(claims.connect(admin).signApproval(1))
      .to.emit(claims, "ClaimApprovalSigned")
      .withArgs(1, admin.address, 1, 2);

    let c = await claims.getClaim(1);
    expect(c.status).to.equal(1); // UnderReview after first sig
    expect(c.oracleRequestId).to.equal(0n);

    await claims.connect(signerB).signApproval(1);
    c = await claims.getClaim(1);
    expect(c.approvalsCount).to.equal(2);
    expect(c.oracleRequestId).to.be.greaterThan(0n);
  });

  it("oracle verified=true triggers payout", async () => {
    await submitClaim();
    await claims.connect(admin).signApproval(1);
    await claims.connect(signerB).signApproval(1);

    const c1 = await claims.getClaim(1);
    const reqId = c1.oracleRequestId;

    const before = await ethers.provider.getBalance(customer.address);
    await expect(oracle.connect(node).fulfillVerification(reqId, true, "ok"))
      .to.emit(claims, "ClaimPaid");
    const after = await ethers.provider.getBalance(customer.address);
    expect(after - before).to.be.closeTo(CLAIM_AMOUNT, ethers.parseEther("0.001"));

    const c2 = await claims.getClaim(1);
    expect(c2.status).to.equal(5); // Paid
  });

  it("oracle verified=false rejects without payout", async () => {
    await submitClaim();
    await claims.connect(admin).signApproval(1);
    await claims.connect(signerB).signApproval(1);
    const reqId = (await claims.getClaim(1)).oracleRequestId;

    await oracle.connect(node).fulfillVerification(reqId, false, "no record");
    const c = await claims.getClaim(1);
    expect(c.status).to.equal(6); // Rejected
    expect(c.rejectReason).to.equal("no record");
  });

  it("appeal flow: claimant appeals, admins accept → re-trigger oracle", async () => {
    // Get to rejected
    await submitClaim();
    await claims.connect(admin).signApproval(1);
    await claims.connect(signerB).signApproval(1);
    const reqId1 = (await claims.getClaim(1)).oracleRequestId;
    await oracle.connect(node).fulfillVerification(reqId1, false, "wrong");

    // File appeal
    await expect(claims.connect(customer).fileAppeal(1, "have more docs"))
      .to.emit(claims, "AppealFiled");
    let c = await claims.getClaim(1);
    expect(c.status).to.equal(7); // Appealed

    // Two admin signers accept
    await claims.connect(admin).reviewAppeal(1, true);
    await claims.connect(signerB).reviewAppeal(1, true);

    c = await claims.getClaim(1);
    expect(c.oracleRequestId).to.not.equal(reqId1); // new oracle request issued

    // Oracle re-verifies true → payout
    await oracle.connect(node).fulfillVerification(c.oracleRequestId, true, "approved");
    expect((await claims.getClaim(1)).status).to.equal(5); // Paid
  });

  it("appeal flow: admins reject appeal → AppealRejected", async () => {
    await submitClaim();
    await claims.connect(admin).signApproval(1);
    await claims.connect(signerB).signApproval(1);
    const reqId = (await claims.getClaim(1)).oracleRequestId;
    await oracle.connect(node).fulfillVerification(reqId, false, "x");
    await claims.connect(customer).fileAppeal(1, "review");

    await claims.connect(admin).reviewAppeal(1, false);
    await claims.connect(signerB).reviewAppeal(1, false);
    expect((await claims.getClaim(1)).status).to.equal(10); // AppealRejected
  });

  it("timeout: anyone can escalate after window passes", async () => {
    await submitClaim();
    // fast-forward
    await ethers.provider.send("evm_increaseTime", [8 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await expect(claims.connect(outsider).escalateExpiredClaim(1))
      .to.emit(claims, "ClaimExpired");
    expect((await claims.getClaim(1)).status).to.equal(11); // Expired
  });

  it("non-signer cannot sign approval", async () => {
    await submitClaim();
    await expect(
      claims.connect(outsider).signApproval(1)
    ).to.be.revertedWith("Claims: not admin signer");
  });
});
