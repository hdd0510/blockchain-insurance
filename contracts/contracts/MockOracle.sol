// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOracleCallback {
    function fulfillVerification(
        uint256 requestId,
        uint256 claimId,
        bool verified,
        string calldata note
    ) external;
}

/**
 * @title MockOracle
 * @notice Chainlink-style request/fulfill oracle for hospital verification.
 *         The off-chain `oracle-service` Node.js daemon listens for
 *         `VerificationRequested`, calls the Hospital API, then calls
 *         `fulfillVerification` back to the consumer contract.
 *
 *         Mock-only: trust model is "node operator == backend signer",
 *         no LINK token, no aggregation. Sufficient for academic demo.
 */
contract MockOracle {
    struct Request {
        uint256 id;
        uint256 claimId;
        bytes32 patientId;
        address hospital;
        address consumer;
        bool fulfilled;
        bool verified;
        string note;
        uint256 requestedAt;
        uint256 fulfilledAt;
    }

    address public admin;
    address public oracleNode; // off-chain service signer
    uint256 public requestCount;
    mapping(uint256 => Request) public requests;

    event VerificationRequested(
        uint256 indexed requestId,
        uint256 indexed claimId,
        bytes32 indexed patientId,
        address hospital,
        address consumer
    );
    event VerificationFulfilled(
        uint256 indexed requestId,
        uint256 indexed claimId,
        bool verified,
        string note
    );
    event OracleNodeUpdated(address indexed previous, address indexed current);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Oracle: not admin");
        _;
    }

    modifier onlyOracleNode() {
        require(msg.sender == oracleNode, "Oracle: not oracle node");
        _;
    }

    constructor(address _oracleNode) {
        admin = msg.sender;
        oracleNode = _oracleNode == address(0) ? msg.sender : _oracleNode;
    }

    function setOracleNode(address node) external onlyAdmin {
        emit OracleNodeUpdated(oracleNode, node);
        oracleNode = node;
    }

    /**
     * Called by ClaimsProcessor when admin signers reach threshold.
     * Returns a requestId to track the off-chain verification.
     */
    function requestVerification(
        uint256 claimId,
        bytes32 patientId,
        address hospital
    ) external returns (uint256) {
        requestCount++;
        requests[requestCount] = Request({
            id: requestCount,
            claimId: claimId,
            patientId: patientId,
            hospital: hospital,
            consumer: msg.sender,
            fulfilled: false,
            verified: false,
            note: "",
            requestedAt: block.timestamp,
            fulfilledAt: 0
        });
        emit VerificationRequested(
            requestCount,
            claimId,
            patientId,
            hospital,
            msg.sender
        );
        return requestCount;
    }

    /**
     * Called by the off-chain oracle node after polling Hospital API.
     * Propagates the result back to the consumer (ClaimsProcessor).
     */
    function fulfillVerification(
        uint256 requestId,
        bool verified,
        string calldata note
    ) external onlyOracleNode {
        Request storage r = requests[requestId];
        require(r.id != 0, "Oracle: request not found");
        require(!r.fulfilled, "Oracle: already fulfilled");

        r.fulfilled = true;
        r.verified = verified;
        r.note = note;
        r.fulfilledAt = block.timestamp;

        IOracleCallback(r.consumer).fulfillVerification(
            requestId,
            r.claimId,
            verified,
            note
        );

        emit VerificationFulfilled(requestId, r.claimId, verified, note);
    }

    function getRequest(uint256 requestId)
        external
        view
        returns (Request memory)
    {
        require(requests[requestId].id != 0, "Oracle: request not found");
        return requests[requestId];
    }
}
