// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./InsurancePolicy.sol";
import "./MockOracle.sol";
import "./HospitalRegistry.sol";

/**
 * @title ClaimsProcessor (v2)
 * @notice Decentralised claim engine with:
 *           - Multi-signature admin approvals (N-of-M)
 *           - Oracle-driven hospital verification (auto payout / auto reject)
 *           - Appeal flow for rejected claims
 *           - Auto-timeout / auto-escalation of stale claims
 *
 *         Off-chain components:
 *           - oracle-service (Node.js daemon) polls Hospital API and
 *             calls MockOracle.fulfillVerification.
 *           - backend writes off-chain audit log entries for every state change.
 */
contract ClaimsProcessor is IOracleCallback {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum ClaimStatus {
        Pending,            // 0: submitted by customer, awaiting admin sigs
        UnderReview,        // 1: admin sigs collected, waiting on Oracle
        OracleVerified,     // 2: oracle returned verified=true
        NeedsInfo,          // 3: admin asked customer for more info
        Approved,           // 4: pre-payout
        Paid,               // 5: ETH transferred
        Rejected,           // 6: rejected (oracle false OR admin manual reject)
        Appealed,           // 7: customer filed an appeal
        AppealReviewing,    // 8: admins reviewing appeal
        AppealAccepted,     // 9: appeal accepted -> goes to OracleVerified
        AppealRejected,     // 10: appeal denied (final)
        Expired             // 11: auto-cancelled due to timeout
    }

    struct Claim {
        uint256 id;
        uint256 policyId;
        address claimant;
        uint256 amount;             // wei
        bytes32 evidenceHash;       // sha256/keccak256 of IPFS CID payload
        bytes32 patientId;          // keccak256(patient national-id / health-id)
        address hospital;           // expected hospital that can verify
        ClaimStatus status;
        uint256 submittedAt;
        uint256 processedAt;
        string rejectReason;
        uint256 oracleRequestId;    // last oracle request id (0 if none)
        uint8 approvalsCount;
        bool oracleVerified;
        string oracleNote;
    }

    struct Appeal {
        uint256 claimId;
        address appellant;
        string reason;
        uint256 filedAt;
        uint256 resolvedAt;
        bool resolved;
        bool accepted;
    }

    // ------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------

    InsurancePolicy public policyContract;
    MockOracle public oracle;
    HospitalRegistry public hospitalRegistry;

    address public admin; // bootstrap admin (deployer)
    mapping(address => bool) public isAdminSigner;
    address[] public adminSigners;
    uint8 public threshold; // M in N-of-M

    mapping(uint256 => Claim) public claims;
    uint256 public claimCount;

    // claimId => (signer => signed?)
    mapping(uint256 => mapping(address => bool)) public approvals;
    // appeal storage keyed by claimId
    mapping(uint256 => Appeal) public appeals;
    mapping(uint256 => mapping(address => bool)) public appealApprovals;
    mapping(uint256 => uint8) public appealApprovalsCount;

    // timeout settings
    uint256 public claimTimeoutSeconds; // e.g. 7 days

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed policyId,
        address indexed claimant,
        uint256 amount,
        bytes32 patientId,
        address hospital
    );
    event ClaimStatusUpdated(uint256 indexed claimId, ClaimStatus newStatus);
    event ClaimApprovalSigned(uint256 indexed claimId, address indexed signer, uint8 totalSignatures, uint8 thresholdRequired);
    event OracleVerificationRequested(uint256 indexed claimId, uint256 indexed requestId);
    event OracleVerificationReceived(uint256 indexed claimId, uint256 indexed requestId, bool verified, string note);
    event ClaimPaid(uint256 indexed claimId, address indexed claimant, uint256 amount);
    event ClaimRejected(uint256 indexed claimId, string reason);
    event ClaimExpired(uint256 indexed claimId);
    event AppealFiled(uint256 indexed claimId, address indexed appellant, string reason);
    event AppealReviewSigned(uint256 indexed claimId, address indexed signer, bool accept, uint8 totalSignatures);
    event AppealResolved(uint256 indexed claimId, bool accepted);
    event AdminSignerAdded(address indexed signer);
    event AdminSignerRemoved(address indexed signer);
    event ThresholdChanged(uint8 newThreshold);

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------

    modifier onlyAdmin() {
        require(msg.sender == admin, "Claims: not admin");
        _;
    }

    modifier onlyAdminSigner() {
        require(isAdminSigner[msg.sender], "Claims: not admin signer");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == address(oracle), "Claims: not oracle");
        _;
    }

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor(
        address _policyContract,
        address _oracle,
        address _hospitalRegistry,
        address[] memory initialSigners,
        uint8 _threshold,
        uint256 _claimTimeoutSeconds
    ) payable {
        require(_threshold >= 1, "Claims: threshold>=1");
        require(initialSigners.length >= _threshold, "Claims: signers >= threshold");

        admin = msg.sender;
        policyContract = InsurancePolicy(_policyContract);
        oracle = MockOracle(_oracle);
        hospitalRegistry = HospitalRegistry(_hospitalRegistry);
        threshold = _threshold;
        claimTimeoutSeconds = _claimTimeoutSeconds == 0 ? 7 days : _claimTimeoutSeconds;

        for (uint256 i = 0; i < initialSigners.length; i++) {
            address s = initialSigners[i];
            require(s != address(0), "Claims: zero signer");
            if (!isAdminSigner[s]) {
                isAdminSigner[s] = true;
                adminSigners.push(s);
                emit AdminSignerAdded(s);
            }
        }
    }

    receive() external payable {}

    // ------------------------------------------------------------------
    // Admin management
    // ------------------------------------------------------------------

    function addAdminSigner(address signer) external onlyAdmin {
        require(signer != address(0), "Claims: zero signer");
        require(!isAdminSigner[signer], "Claims: already signer");
        isAdminSigner[signer] = true;
        adminSigners.push(signer);
        emit AdminSignerAdded(signer);
    }

    function removeAdminSigner(address signer) external onlyAdmin {
        require(isAdminSigner[signer], "Claims: not signer");
        isAdminSigner[signer] = false;
        // compact array
        for (uint256 i = 0; i < adminSigners.length; i++) {
            if (adminSigners[i] == signer) {
                adminSigners[i] = adminSigners[adminSigners.length - 1];
                adminSigners.pop();
                break;
            }
        }
        emit AdminSignerRemoved(signer);
    }

    function setThreshold(uint8 newThreshold) external onlyAdmin {
        require(newThreshold >= 1 && newThreshold <= adminSigners.length, "Claims: invalid threshold");
        threshold = newThreshold;
        emit ThresholdChanged(newThreshold);
    }

    function getAdminSigners() external view returns (address[] memory) {
        return adminSigners;
    }

    function setClaimTimeoutSeconds(uint256 s) external onlyAdmin {
        require(s >= 1 hours, "Claims: timeout too small");
        claimTimeoutSeconds = s;
    }

    // ------------------------------------------------------------------
    // Customer: submit claim
    // ------------------------------------------------------------------

    function submitClaim(
        uint256 policyId,
        uint256 amount,
        bytes32 evidenceHash,
        bytes32 patientId,
        address hospital
    ) external returns (uint256) {
        require(policyContract.isValid(policyId), "Claims: policy invalid/expired");
        InsurancePolicy.Policy memory p = policyContract.getPolicy(policyId);
        require(msg.sender == p.customer, "Claims: not policy owner");
        require(amount > 0 && amount <= p.maxCoverage, "Claims: invalid amount");
        require(
            hospital == address(0) || hospitalRegistry.isActiveHospital(hospital),
            "Claims: hospital not active"
        );

        claimCount++;
        claims[claimCount] = Claim({
            id: claimCount,
            policyId: policyId,
            claimant: msg.sender,
            amount: amount,
            evidenceHash: evidenceHash,
            patientId: patientId,
            hospital: hospital,
            status: ClaimStatus.Pending,
            submittedAt: block.timestamp,
            processedAt: 0,
            rejectReason: "",
            oracleRequestId: 0,
            approvalsCount: 0,
            oracleVerified: false,
            oracleNote: ""
        });

        emit ClaimSubmitted(claimCount, policyId, msg.sender, amount, patientId, hospital);
        return claimCount;
    }

    // ------------------------------------------------------------------
    // Admin signer: multi-sig approval that triggers oracle verification
    // ------------------------------------------------------------------

    /**
     * Each admin signer calls this once per claim. When `threshold` unique
     * signers have signed, the contract automatically requests verification
     * from the oracle. ETH is NOT paid yet; payout happens only after the
     * oracle returns verified=true via fulfillVerification.
     */
    function signApproval(uint256 claimId) external onlyAdminSigner {
        Claim storage c = claims[claimId];
        require(c.id != 0, "Claims: not found");
        require(
            c.status == ClaimStatus.Pending || c.status == ClaimStatus.UnderReview || c.status == ClaimStatus.NeedsInfo,
            "Claims: cannot sign in this status"
        );
        require(!approvals[claimId][msg.sender], "Claims: already signed");

        approvals[claimId][msg.sender] = true;
        c.approvalsCount += 1;

        if (c.status == ClaimStatus.Pending) {
            c.status = ClaimStatus.UnderReview;
            emit ClaimStatusUpdated(claimId, ClaimStatus.UnderReview);
        }

        emit ClaimApprovalSigned(claimId, msg.sender, c.approvalsCount, threshold);

        if (c.approvalsCount >= threshold && c.oracleRequestId == 0) {
            _requestOracleVerification(claimId);
        }
    }

    function _requestOracleVerification(uint256 claimId) internal {
        Claim storage c = claims[claimId];
        require(c.hospital != address(0), "Claims: no hospital set");
        uint256 reqId = oracle.requestVerification(claimId, c.patientId, c.hospital);
        c.oracleRequestId = reqId;
        emit OracleVerificationRequested(claimId, reqId);
    }

    /**
     * Manual escape hatch: admin signer can re-trigger oracle if previous
     * call failed (e.g. hospital was inactive). Available only when claim
     * has enough signatures but no live oracle request.
     */
    function retriggerOracle(uint256 claimId) external onlyAdminSigner {
        Claim storage c = claims[claimId];
        require(c.id != 0, "Claims: not found");
        require(c.approvalsCount >= threshold, "Claims: not enough sigs");
        require(c.status == ClaimStatus.UnderReview || c.status == ClaimStatus.AppealReviewing, "Claims: bad status");
        _requestOracleVerification(claimId);
    }

    // ------------------------------------------------------------------
    // Oracle callback: auto payout or auto reject
    // ------------------------------------------------------------------

    function fulfillVerification(
        uint256 requestId,
        uint256 claimId,
        bool verified,
        string calldata note
    ) external override onlyOracle {
        Claim storage c = claims[claimId];
        require(c.id != 0, "Claims: not found");
        require(c.oracleRequestId == requestId, "Claims: stale request");
        require(
            c.status == ClaimStatus.UnderReview || c.status == ClaimStatus.AppealReviewing,
            "Claims: bad status for fulfill"
        );

        c.oracleVerified = verified;
        c.oracleNote = note;
        emit OracleVerificationReceived(claimId, requestId, verified, note);

        if (verified) {
            c.status = ClaimStatus.OracleVerified;
            emit ClaimStatusUpdated(claimId, ClaimStatus.OracleVerified);
            _payout(claimId);
        } else {
            c.status = ClaimStatus.Rejected;
            c.processedAt = block.timestamp;
            c.rejectReason = bytes(note).length > 0 ? note : "Oracle verification failed";
            emit ClaimRejected(claimId, c.rejectReason);
            emit ClaimStatusUpdated(claimId, ClaimStatus.Rejected);
        }
    }

    function _payout(uint256 claimId) internal {
        Claim storage c = claims[claimId];
        require(address(this).balance >= c.amount, "Claims: contract underfunded");

        c.status = ClaimStatus.Approved;
        emit ClaimStatusUpdated(claimId, ClaimStatus.Approved);

        (bool ok, ) = c.claimant.call{value: c.amount}("");
        require(ok, "Claims: transfer failed");

        c.status = ClaimStatus.Paid;
        c.processedAt = block.timestamp;
        emit ClaimPaid(claimId, c.claimant, c.amount);
        emit ClaimStatusUpdated(claimId, ClaimStatus.Paid);
    }

    // ------------------------------------------------------------------
    // Manual reject (still possible by admin signer for non-oracle reasons)
    // ------------------------------------------------------------------

    function rejectClaim(uint256 claimId, string calldata reason) external onlyAdminSigner {
        Claim storage c = claims[claimId];
        require(c.id != 0, "Claims: not found");
        require(
            c.status == ClaimStatus.Pending ||
                c.status == ClaimStatus.UnderReview ||
                c.status == ClaimStatus.NeedsInfo,
            "Claims: cannot reject in current status"
        );

        c.status = ClaimStatus.Rejected;
        c.processedAt = block.timestamp;
        c.rejectReason = reason;
        emit ClaimRejected(claimId, reason);
        emit ClaimStatusUpdated(claimId, ClaimStatus.Rejected);
    }

    function updateClaimStatus(uint256 claimId, ClaimStatus newStatus) external onlyAdminSigner {
        Claim storage c = claims[claimId];
        require(c.id != 0, "Claims: not found");
        require(
            c.status != ClaimStatus.Paid &&
                c.status != ClaimStatus.Rejected &&
                c.status != ClaimStatus.AppealRejected &&
                c.status != ClaimStatus.Expired,
            "Claims: terminal status"
        );
        // Only allow movement to a curated set to avoid corrupting the FSM.
        require(
            newStatus == ClaimStatus.NeedsInfo || newStatus == ClaimStatus.UnderReview,
            "Claims: status not allowed manually"
        );
        c.status = newStatus;
        emit ClaimStatusUpdated(claimId, newStatus);
    }

    // ------------------------------------------------------------------
    // Appeals (Section 2.4)
    // ------------------------------------------------------------------

    function fileAppeal(uint256 claimId, string calldata reason) external {
        Claim storage c = claims[claimId];
        require(c.id != 0, "Claims: not found");
        require(c.claimant == msg.sender, "Claims: not claimant");
        require(
            c.status == ClaimStatus.Rejected,
            "Claims: only rejected claims can appeal"
        );
        require(appeals[claimId].claimId == 0, "Claims: appeal already filed");

        appeals[claimId] = Appeal({
            claimId: claimId,
            appellant: msg.sender,
            reason: reason,
            filedAt: block.timestamp,
            resolvedAt: 0,
            resolved: false,
            accepted: false
        });

        c.status = ClaimStatus.Appealed;
        emit AppealFiled(claimId, msg.sender, reason);
        emit ClaimStatusUpdated(claimId, ClaimStatus.Appealed);
    }

    function reviewAppeal(uint256 claimId, bool accept) external onlyAdminSigner {
        Claim storage c = claims[claimId];
        Appeal storage a = appeals[claimId];
        require(a.claimId != 0, "Claims: no appeal");
        require(!a.resolved, "Claims: appeal resolved");
        require(
            c.status == ClaimStatus.Appealed || c.status == ClaimStatus.AppealReviewing,
            "Claims: bad status for appeal review"
        );
        require(!appealApprovals[claimId][msg.sender], "Claims: already voted");

        appealApprovals[claimId][msg.sender] = true;
        appealApprovalsCount[claimId] += 1;

        if (c.status == ClaimStatus.Appealed) {
            c.status = ClaimStatus.AppealReviewing;
            emit ClaimStatusUpdated(claimId, ClaimStatus.AppealReviewing);
        }

        emit AppealReviewSigned(claimId, msg.sender, accept, appealApprovalsCount[claimId]);

        // First admin that votes "accept" with reached threshold OR
        // single accept after threshold reached -> resolve immediately.
        if (accept && appealApprovalsCount[claimId] >= threshold) {
            a.resolved = true;
            a.accepted = true;
            a.resolvedAt = block.timestamp;
            // Reset oracle so we re-query the hospital with appeal context.
            c.oracleRequestId = 0;
            // Trigger oracle again (the off-chain service can pass appeal note).
            _requestOracleVerification(claimId);
            emit AppealResolved(claimId, true);
        } else if (!accept && appealApprovalsCount[claimId] >= threshold) {
            a.resolved = true;
            a.accepted = false;
            a.resolvedAt = block.timestamp;
            c.status = ClaimStatus.AppealRejected;
            emit AppealResolved(claimId, false);
            emit ClaimStatusUpdated(claimId, ClaimStatus.AppealRejected);
        }
    }

    // ------------------------------------------------------------------
    // Timeout / auto-cancel (Section 2.5)
    // ------------------------------------------------------------------

    /**
     * Anyone can call. If a claim is stuck in a non-terminal state past
     * `claimTimeoutSeconds`, it's auto-marked Expired and emits an event.
     * Refunds nothing (no premium escrow yet) but unblocks the customer
     * to refile.
     */
    function escalateExpiredClaim(uint256 claimId) external {
        Claim storage c = claims[claimId];
        require(c.id != 0, "Claims: not found");
        require(
            c.status == ClaimStatus.Pending ||
                c.status == ClaimStatus.UnderReview ||
                c.status == ClaimStatus.NeedsInfo,
            "Claims: not pending"
        );
        require(block.timestamp >= c.submittedAt + claimTimeoutSeconds, "Claims: not expired");

        c.status = ClaimStatus.Expired;
        c.processedAt = block.timestamp;
        c.rejectReason = "Auto-expired after timeout";
        emit ClaimExpired(claimId);
        emit ClaimStatusUpdated(claimId, ClaimStatus.Expired);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        require(claims[claimId].id != 0, "Claims: not found");
        return claims[claimId];
    }

    function getAppeal(uint256 claimId) external view returns (Appeal memory) {
        require(appeals[claimId].claimId != 0, "Claims: appeal not found");
        return appeals[claimId];
    }

    function hasSigned(uint256 claimId, address signer) external view returns (bool) {
        return approvals[claimId][signer];
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
