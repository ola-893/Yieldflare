// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @notice Minimal interface for Flare's MintingTagManager
 */
interface IMintingTagManager {
    /**
     * @notice Reserve a new minting tag (pay reservation fee)
     * @return tag The reserved tag ID
     */
    function reserve() external payable returns (uint256 tag);

    /**
     * @notice Set the minting recipient for a tag
     * @param tag Tag identifier
     * @param recipient Address to receive minted FAssets
     */
    function setMintingRecipient(uint256 tag, address recipient) external;

    /**
     * @notice Set the allowed executor for a tag
     * @param tag Tag identifier
     * @param executor Address authorized to execute minting
     */
    function setAllowedExecutor(uint256 tag, address executor) external;

    /**
     * @notice Get the reservation fee amount
     * @return Fee in native currency
     */
    function reservationFee() external view returns (uint256);
    
    function mintingRecipient(uint256 mintingTag) external view returns (address);
    function allowedExecutor(uint256 mintingTag) external view returns (address);
}
