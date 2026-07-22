// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IStrategyAdapter
 * @notice Standard interface for wrapping different yield-bearing protocols on Flare.
 */
interface IStrategyAdapter {
    /**
     * @notice Deposit assets into the underlying yield protocol.
     * @param amount The amount of assets to deposit.
     * @return The amount of receipt tokens or yield-bearing tokens received.
     */
    function deposit(uint256 amount) external returns (uint256);

    /**
     * @notice Withdraw assets from the underlying yield protocol.
     * @param amount The amount of underlying assets to withdraw.
     * @return The actual amount withdrawn.
     */
    function withdraw(uint256 amount) external returns (uint256);

    /**
     * @notice Withdraws all assets from the strategy. Used during rebalancing.
     * @return The total amount of assets withdrawn and sent back to the vault.
     */
    function withdrawAll() external returns (uint256);

    /**
     * @notice Returns the total value of assets managed by this strategy.
     * @return The current value in underlying asset terms (including accrued yield).
     */
    function totalValue() external view returns (uint256);
}
