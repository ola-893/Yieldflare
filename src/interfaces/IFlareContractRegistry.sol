// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IFlareContractRegistry
 * @notice Interface for Flare's contract registry (same address on all networks)
 * @dev Registry Address: 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019
 */
interface IFlareContractRegistry {
    /**
     * @notice Returns contract address for the given name - the current one
     * @param _name Contract name
     * @return Address corresponding to the name
     */
    function getContractAddressByName(string calldata _name) external view returns (address);

    /**
     * @notice Returns contract address for the given name hash
     * @param _nameHash Keccak256 hash of the contract name
     * @return Address corresponding to the name hash
     */
    function getContractAddressByHash(bytes32 _nameHash) external view returns (address);

    /**
     * @notice Returns all contract names registered
     * @return Array of contract names
     */
    function getAllContractNames() external view returns (string[] memory);
}
