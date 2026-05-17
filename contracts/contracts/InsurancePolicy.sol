// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract InsurancePolicy {
    enum PolicyStatus { Active, Expired, Cancelled }

    struct Policy {
        uint256 id;
        address customer;
        string policyType;
        uint256 premium;        // wei
        uint256 maxCoverage;    // wei
        uint256 startDate;
        uint256 endDate;
        PolicyStatus status;
        bytes32 documentHash;
    }

    mapping(uint256 => Policy) public policies;
    mapping(address => uint256[]) public customerPolicies;
    uint256 public policyCount;
    address public admin;

    event PolicyCreated(uint256 indexed policyId, address indexed customer, string policyType);
    event PolicyCancelled(uint256 indexed policyId);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function createPolicy(
        address customer,
        string memory policyType,
        uint256 premium,
        uint256 maxCoverage,
        uint256 durationDays,
        bytes32 documentHash
    ) external onlyAdmin returns (uint256) {
        policyCount++;
        policies[policyCount] = Policy({
            id: policyCount,
            customer: customer,
            policyType: policyType,
            premium: premium,
            maxCoverage: maxCoverage,
            startDate: block.timestamp,
            endDate: block.timestamp + (durationDays * 1 days),
            status: PolicyStatus.Active,
            documentHash: documentHash
        });
        customerPolicies[customer].push(policyCount);
        emit PolicyCreated(policyCount, customer, policyType);
        return policyCount;
    }

    function cancelPolicy(uint256 policyId) external onlyAdmin {
        require(policies[policyId].id != 0, "Policy not found");
        policies[policyId].status = PolicyStatus.Cancelled;
        emit PolicyCancelled(policyId);
    }

    function isValid(uint256 policyId) public view returns (bool) {
        Policy memory p = policies[policyId];
        return p.id != 0
            && p.status == PolicyStatus.Active
            && block.timestamp <= p.endDate;
    }

    function getCustomerPolicies(address customer) external view returns (uint256[] memory) {
        return customerPolicies[customer];
    }

    function getPolicy(uint256 policyId) external view returns (Policy memory) {
        require(policies[policyId].id != 0, "Policy not found");
        return policies[policyId];
    }
}
