// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IKToken
 * @notice Compound-v2 style receipt token interface used by Kinetic Market on Flare.
 * @dev Kinetic is a Compound-v2 fork. `mint` returns 0 on success, non-zero on error.
 *      `redeemUnderlying` specifies the exact underlying amount to withdraw.
 */
interface IKToken {
    /// @notice Supply `mintAmount` of the underlying asset. Returns 0 on success.
    function mint(uint256 mintAmount) external returns (uint256);

    /// @notice Withdraw exactly `redeemAmount` of the underlying. Returns 0 on success.
    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);

    /// @notice Redeem `redeemTokens` kTokens for underlying. Returns 0 on success.
    function redeem(uint256 redeemTokens) external returns (uint256);

    /// @notice kToken balance of `owner`.
    function balanceOf(address owner) external view returns (uint256);

    /// @notice Underlying balance including accrued interest (non-view, accrues first).
    function balanceOfUnderlying(address owner) external returns (uint256);

    /// @notice Current exchange rate (scaled by 1e18) without accruing.
    function exchangeRateStored() external view returns (uint256);

    /// @notice Underlying ERC-20 address.
    function underlying() external view returns (address);
}
