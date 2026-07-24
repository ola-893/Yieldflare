// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IFAssetAdapter
 * @notice Interface for routing tag-based FAsset direct mints into the ParentVault.
 */
interface IFAssetAdapter {
    /**
     * @notice Reserves a MintingTagManager tag and maps it to the caller.
     * @return tag The XRPL-compatible destination tag assigned by Flare.
     */
    function registerMintingTag() external payable returns (uint256 tag);

    /**
     * @notice Records an FAsset amount that was directly minted to this adapter using a registered tag.
     * @dev The caller must be the tag's currently active Flare direct-mint executor.
     * @param tag MintingTagManager tag used for the underlying-chain payment.
     * @param depositId Unique direct-mint identifier supplied by the executor.
     * @param observedMintedAmount Post-fee amount observed from the direct-mint execution.
     */
    function processDirectMint(uint256 tag, bytes32 depositId, uint256 observedMintedAmount) external;

    /**
     * @notice Transfers a recorded post-fee FAsset amount to the ParentVault and mints ERC-4626 shares.
     * @param depositId Identifier created by {processDirectMint}.
     */
    function settleDirectMint(bytes32 depositId) external returns (uint256 shares);
}
