// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @notice Minimal, ABI-compatible subset of Flare's IMintingTagManager used by FAssetAdapter.
 * @dev The full official interface additionally exposes ERC-721 enumeration and tag-transfer helpers.
 */
interface IMintingTagManager {
    function reserve() external payable returns (uint256);
    function setMintingRecipient(uint256 mintingTag, address recipient) external;
    function setAllowedExecutor(uint256 mintingTag, address executor) external;
    function reservationFee() external view returns (uint256);
    function mintingRecipient(uint256 mintingTag) external view returns (address);
    function allowedExecutor(uint256 mintingTag) external view returns (address);
}
