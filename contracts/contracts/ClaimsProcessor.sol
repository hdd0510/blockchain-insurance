// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./InsurancePolicy.sol";

contract ClaimsProcessor {
    enum ClaimStatus { Pending, UnderReview, NeedsInfo, Approved, Rejected, Paid }

    struct Claim {
        uint256 id;
        uint256 policyId;
        address claimant;
        uint256 amount;         // wei
        bytes32 evidenceHash;
        ClaimStatus status;
        uint256 submittedAt;
        uint256 processedAt;
        string rejectReason;
    }

    InsurancePolicy public policyContract;
    mapping(uint256 => Claim) public claims;
    uint256 public claimCount;
    address public admin;

    event ClaimSubmitted(uint256 indexed claimId, uint256 indexed policyId, address claimant, uint256 amount);
    event ClaimStatusUpdated(uint256 indexed claimId, ClaimStatus newStatus);
    event ClaimPaid(uint256 indexed claimId, address indexed claimant, uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor(address _policyContract) payable {
        admin = msg.sender;
        policyContract = InsurancePolicy(_policyContract);
    }

    // Fund the contract so it can pay out claims
    receive() external payable {}

    function submitClaim(
        uint256 policyId,
        uint256 amount,
        bytes32 evidenceHash
    ) external returns (uint256) {
        require(policyContract.isValid(policyId), "Policy not valid or expired");

        InsurancePolicy.Policy memory p = policyContract.getPolicy(policyId);
        require(msg.sender == p.customer, "Not policy owner");
        require(amount > 0 && amount <= p.maxCoverage, "Invalid claim amount");

        claimCount++;
        claims[claimCount] = Claim({
            id: claimCount,
            policyId: policyId,
            claimant: msg.sender,
            amount: amount,
            evidenceHash: evidenceHash,
            status: ClaimStatus.Pending,
            submittedAt: block.timestamp,
            processedAt: 0,
            rejectReason: ""
        });

        emit ClaimSubmitted(claimCount, policyId, msg.sender, amount);
        return claimCount;
    }

    function approveClaim(uint256 claimId) external onlyAdmin {
        Claim storage claim = claims[claimId];
        require(claim.id != 0, "Claim not found");
        require(
            claim.status == ClaimStatus.Pending || claim.status == ClaimStatus.UnderReview,
            "Cannot approve in current status"
        );
        require(address(this).balance >= claim.amount, "Insufficient contract balance");

        claim.status = ClaimStatus.Approved;
        claim.processedAt = block.timestamp;

        (bool sent, ) = claim.claimant.call{value: claim.amount}("");
        require(sent, "ETH transfer failed");

        claim.status = ClaimStatus.Paid;
        emit ClaimPaid(claimId, claim.claimant, claim.amount);
    }

    function rejectClaim(uint256 claimId, string memory reason) external onlyAdmin {
        Claim storage claim = claims[claimId];
        require(claim.id != 0, "Claim not found");
        require(
            claim.status == ClaimStatus.Pending || claim.status == ClaimStatus.UnderReview,
            "Cannot reject in current status"
        );

        claim.status = ClaimStatus.Rejected;
        claim.processedAt = block.timestamp;
        claim.rejectReason = reason;

        emit ClaimStatusUpdated(claimId, ClaimStatus.Rejected);
    }

    function updateClaimStatus(uint256 claimId, ClaimStatus newStatus) external onlyAdmin {
        require(claims[claimId].id != 0, "Claim not found");
        // Cannot move backwards from terminal states
        require(
            claims[claimId].status != ClaimStatus.Paid &&
            claims[claimId].status != ClaimStatus.Rejected,
            "Claim already finalized"
        );
        claims[claimId].status = newStatus;
        emit ClaimStatusUpdated(claimId, newStatus);
    }

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        require(claims[claimId].id != 0, "Claim not found");
        return claims[claimId];
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
