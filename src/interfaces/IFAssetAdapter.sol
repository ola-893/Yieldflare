// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IFAssetAdapter
 * @notice Interface for routing non-smart contract deposits into Flare via FAssets Direct Minting.
 */
interface IFAssetAdapter {
    /**
     * @notice Initiates a direct minting flow using a specific tag.
     * @param underlyingChainId The ID of the original chain (e.g., XRP, BTC).
     * @param amount The amount to mint.
     * @param proof The state connector proof of the underlying deposit.
     */
    function processDirectMint(
        uint256 underlyingChainId, 
        uint256 amount, 
        bytes calldata proof
    ) external;

    /**
     * @notice Converts YieldCoin back into underlying assets via the FAsset system.
     * @param fAssetAmount The amount of FAssets to redeem.
     * @param destinationAddress The address on the underlying chain to send funds to.
     */
    function requestRedemption(
        uint256 fAssetAmount, 
        string calldata destinationAddress
    ) external;
}
