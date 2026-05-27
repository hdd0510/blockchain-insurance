// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HospitalRegistry
 * @notice Whitelist of hospital/verification entities allowed to confirm
 *         patient records. Admin manages the list; Oracle queries it
 *         before forwarding the verification request off-chain.
 */
contract HospitalRegistry {
    struct Hospital {
        address wallet;
        string name;
        string apiEndpoint; // off-chain Hospital API base URL
        bool active;
        uint256 registeredAt;
    }

    address public admin;
    mapping(address => Hospital) public hospitals;
    address[] public hospitalList;

    event HospitalRegistered(address indexed wallet, string name, string apiEndpoint);
    event HospitalUpdated(address indexed wallet, string name, string apiEndpoint, bool active);
    event HospitalDeactivated(address indexed wallet);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Hospital: not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function registerHospital(
        address wallet,
        string memory name,
        string memory apiEndpoint
    ) external onlyAdmin {
        require(wallet != address(0), "Hospital: zero address");
        require(hospitals[wallet].wallet == address(0), "Hospital: already registered");

        hospitals[wallet] = Hospital({
            wallet: wallet,
            name: name,
            apiEndpoint: apiEndpoint,
            active: true,
            registeredAt: block.timestamp
        });
        hospitalList.push(wallet);
        emit HospitalRegistered(wallet, name, apiEndpoint);
    }

    function updateHospital(
        address wallet,
        string memory name,
        string memory apiEndpoint,
        bool active
    ) external onlyAdmin {
        require(hospitals[wallet].wallet != address(0), "Hospital: not found");
        Hospital storage h = hospitals[wallet];
        h.name = name;
        h.apiEndpoint = apiEndpoint;
        h.active = active;
        emit HospitalUpdated(wallet, name, apiEndpoint, active);
    }

    function deactivateHospital(address wallet) external onlyAdmin {
        require(hospitals[wallet].wallet != address(0), "Hospital: not found");
        hospitals[wallet].active = false;
        emit HospitalDeactivated(wallet);
    }

    function isActiveHospital(address wallet) external view returns (bool) {
        return hospitals[wallet].active;
    }

    function getHospital(address wallet) external view returns (Hospital memory) {
        require(hospitals[wallet].wallet != address(0), "Hospital: not found");
        return hospitals[wallet];
    }

    function getHospitalCount() external view returns (uint256) {
        return hospitalList.length;
    }

    function getHospitalAt(uint256 index) external view returns (address) {
        require(index < hospitalList.length, "Hospital: index out of bounds");
        return hospitalList[index];
    }
}
