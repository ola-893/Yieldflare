// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IKineticComptroller
 * @notice Minimal Comptroller interface for Kinetic Market (Compound-v2 fork on Flare).
 * @dev Unitroller proxy: 0x15F69897E6aEBE0463401345543C26d1Fd994abB
 */
interface IKineticComptroller {
    /// @notice Claim all accrued JOULE reward tokens for `holder` across the given kToken markets.
    function claimReward(uint8 rewardType, address holder, address[] calldata kTokens) external;

    /// @notice Claim all accrued reward tokens for `holder` across all entered markets.
    function claimReward(uint8 rewardType, address holder) external;
}
