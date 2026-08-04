// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAssetManager
 * @notice Interface for FAssets AssetManager contract
 */
interface IAssetManager {
    struct DirectMintingData {
        address recipient;
        bytes data;
    }

    /**
     * @notice Execute direct minting with custom instruction data (Smart Account 0xFE opcode)
     * @param _tag Minting tag identifier
     * @param _executor Address authorized to execute the minting
     * @param _recipientAndData Encoded recipient address and custom call data
     */
    function executeDirectMintingWithData(
        uint256 _tag,
        address _executor,
        bytes calldata _recipientAndData
    ) external;

    /**
     * @notice Execute direct minting (standard flow)
     * @param _tag Minting tag identifier
     * @param _executor Address authorized to execute the minting
     * @param _observedMintedAmount Amount of FAssets minted (after fees)
     */
    function executeDirectMinting(
        uint256 _tag,
        address _executor,
        uint256 _observedMintedAmount
    ) external;

    /**
     * @notice Get the core vault payment address for direct minting
     */
    function directMintingPaymentAddress() external view returns (string memory);

    /**
     * @notice Get the FAsset token address
     */
    function fAsset() external view returns (address);
}
