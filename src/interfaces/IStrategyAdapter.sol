// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IStrategyAdapter
 * @notice Standard interface for wrapping different yield-bearing protocols on Flare.
 */
interface IStrategyAdapter {
    /**
     * @notice Underlying ERC-20 managed by this adapter.
     * @dev The parent vault verifies this value before approving an adapter.
     */
    function asset() external view returns (address);

    /**
     * @notice Deposit assets into the underlying yield protocol.
     * @param amount The amount of assets to deposit.
     * @return assetsDeposited The underlying amount actually accepted by the protocol.
     */
    function deposit(uint256 amount) external returns (uint256 assetsDeposited);

    /**
     * @notice Withdraw assets from the underlying yield protocol.
     * @param amount The amount of underlying assets to withdraw.
     * @param minAmountOut Minimum underlying asset amount acceptable to the vault.
     * @return assetsWithdrawn The actual amount withdrawn.
     */
    function withdraw(uint256 amount, uint256 minAmountOut) external returns (uint256 assetsWithdrawn);

    /**
     * @notice Withdraws all assets from the strategy. Used during rebalancing.
     * @param minAmountOut Minimum underlying asset amount acceptable to the vault.
     * @return assetsWithdrawn The total amount of assets withdrawn and sent back to the vault.
     */
    function withdrawAll(uint256 minAmountOut) external returns (uint256 assetsWithdrawn);

    /**
     * @notice Returns the total value of assets managed by this strategy.
     * @return The current value in underlying asset terms (including accrued yield).
     */
    function totalValue() external view returns (uint256);
}
