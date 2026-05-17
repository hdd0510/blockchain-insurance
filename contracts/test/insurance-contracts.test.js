const { expect } = require("chai");
const { ethers } = require("hardhat");

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
      "health",
      ethers.parseEther("0.01"),
      ethers.parseEther("1"),
      365,
      ethers.keccak256(ethers.toUtf8Bytes("doc"))
    );

  it("admin can create a policy", async () => {
    await expect(createTestPolicy())
      .to.emit(policy, "PolicyCreated")
      .withArgs(1, customer.address, "health");

    const p = await policy.getPolicy(1);
    expect(p.customer).to.equal(customer.address);
    expect(p.policyType).to.equal("health");
    expect(p.maxCoverage).to.equal(ethers.parseEther("1"));
  });

  it("non-admin cannot create a policy", async () => {
    await expect(
      policy.connect(other).createPolicy(customer.address, "health",
        ethers.parseEther("0.01"), ethers.parseEther("1"), 365,
        ethers.keccak256(ethers.toUtf8Bytes("doc")))
    ).to.be.revertedWith("Not admin");
  });

  it("isValid returns true for active policy", async () => {
    await createTestPolicy();
    expect(await policy.isValid(1)).to.be.true;
  });

  it("getCustomerPolicies returns correct ids", async () => {
    await createTestPolicy();
    await createTestPolicy();
    const ids = await policy.getCustomerPolicies(customer.address);
    expect(ids.length).to.equal(2);
    expect(ids[0]).to.equal(1);
    expect(ids[1]).to.equal(2);
  });

  it("admin can cancel a policy", async () => {
    await createTestPolicy();
    await policy.connect(admin).cancelPolicy(1);
    expect(await policy.isValid(1)).to.be.false;
  });
});

describe("ClaimsProcessor", () => {
  let policy, claims, admin, customer, other;
  const SEED = ethers.parseEther("1");
  const CLAIM_AMOUNT = ethers.parseEther("0.3");
  const EVIDENCE = ethers.keccak256(ethers.toUtf8Bytes("evidence"));

  beforeEach(async () => {
    [admin, customer, other] = await ethers.getSigners();

    const Policy = await ethers.getContractFactory("InsurancePolicy");
    policy = await Policy.deploy();

    const Claims = await ethers.getContractFactory("ClaimsProcessor");
    claims = await Claims.deploy(await policy.getAddress(), { value: SEED });

    // Create a policy for customer
    await policy.connect(admin).createPolicy(
      customer.address, "health",
      ethers.parseEther("0.01"), ethers.parseEther("1"),
      365, ethers.keccak256(ethers.toUtf8Bytes("doc"))
    );
  });

  it("customer can submit a claim", async () => {
    await expect(claims.connect(customer).submitClaim(1, CLAIM_AMOUNT, EVIDENCE))
      .to.emit(claims, "ClaimSubmitted")
      .withArgs(1, 1, customer.address, CLAIM_AMOUNT);

    const claim = await claims.getClaim(1);
    expect(claim.claimant).to.equal(customer.address);
    expect(claim.amount).to.equal(CLAIM_AMOUNT);
    expect(claim.status).to.equal(0); // Pending
  });

  it("rejects claim if policy is not valid", async () => {
    await policy.connect(admin).cancelPolicy(1);
    await expect(
      claims.connect(customer).submitClaim(1, CLAIM_AMOUNT, EVIDENCE)
    ).to.be.revertedWith("Policy not valid or expired");
  });

  it("rejects claim if amount exceeds maxCoverage", async () => {
    await expect(
      claims.connect(customer).submitClaim(1, ethers.parseEther("2"), EVIDENCE)
    ).to.be.revertedWith("Invalid claim amount");
  });

  it("rejects claim from non-policy-owner", async () => {
    await expect(
      claims.connect(other).submitClaim(1, CLAIM_AMOUNT, EVIDENCE)
    ).to.be.revertedWith("Not policy owner");
  });

  it("admin can approve claim and customer receives ETH", async () => {
    await claims.connect(customer).submitClaim(1, CLAIM_AMOUNT, EVIDENCE);

    const before = await ethers.provider.getBalance(customer.address);
    await claims.connect(admin).approveClaim(1);
    const after = await ethers.provider.getBalance(customer.address);

    expect(after - before).to.be.closeTo(CLAIM_AMOUNT, ethers.parseEther("0.001"));

    const claim = await claims.getClaim(1);
    expect(claim.status).to.equal(5); // Paid
  });

  it("admin can reject claim with reason", async () => {
    await claims.connect(customer).submitClaim(1, CLAIM_AMOUNT, EVIDENCE);
    await claims.connect(admin).rejectClaim(1, "Insufficient evidence");

    const claim = await claims.getClaim(1);
    expect(claim.status).to.equal(4); // Rejected
    expect(claim.rejectReason).to.equal("Insufficient evidence");
  });

  it("non-admin cannot approve", async () => {
    await claims.connect(customer).submitClaim(1, CLAIM_AMOUNT, EVIDENCE);
    await expect(claims.connect(other).approveClaim(1)).to.be.revertedWith("Not admin");
  });

  it("full lifecycle: submit → under review → approve → paid", async () => {
    await claims.connect(customer).submitClaim(1, CLAIM_AMOUNT, EVIDENCE);
    await claims.connect(admin).updateClaimStatus(1, 1); // UnderReview
    expect((await claims.getClaim(1)).status).to.equal(1);

    await claims.connect(admin).approveClaim(1);
    expect((await claims.getClaim(1)).status).to.equal(5); // Paid
  });
});
