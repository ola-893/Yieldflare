// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IParentVault
 * @notice Central vault that handles user deposits, mints YieldToken, and delegates funds to StrategyAdapters.
 */
interface IParentVault {
    struct RebalancePayload {
        address newStrategy;
        uint256 nonce;
        uint256 deadline;
        bytes signature;
    }

    event Deposited(address indexed user, uint256 assets, uint256 shares);
    event Withdrawn(address indexed user, uint256 assets, uint256 shares);
    event Rebalanced(address indexed oldStrategy, address indexed newStrategy);

    function deposit(uint256 amount) external returns (uint256 shares);
    function withdraw(uint256 shares) external returns (uint256 amount);
    function executeRebalance(RebalancePayload calldata payload) external;
    function totalUnderlyingValue() external view returns (uint256);
}
