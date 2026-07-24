// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IParentVault
 * @notice Central vault that handles user deposits, mints FlareYield shares, and delegates funds to StrategyAdapters.
 */
interface IParentVault {
    struct RebalancePayload {
        address newStrategy;
        uint256 minAmountOut;
        uint256 nonce;
        uint256 deadline;
        uint256 twapStart;
        uint256 twapEnd;
        bytes32 strategyDataHash;
        bytes signature;
    }

    event Rebalanced(
        address indexed oldStrategy, address indexed newStrategy, uint256 assetsWithdrawn, uint256 assetsDeposited
    );

    function asset() external view returns (address);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function queueFAssetDeposit(bytes32 depositId, address receiver) external;
    function settleFAssetDeposit(bytes32 depositId, uint256 assets) external returns (uint256 shares);
    function executeRebalance(RebalancePayload calldata payload) external;
    function totalUnderlyingValue() external view returns (uint256);
}
