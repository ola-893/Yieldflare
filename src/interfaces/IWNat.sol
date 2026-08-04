// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IWNat
 * @notice Wrapped Native token (WC2FLR on Coston2, WFLR on mainnet)
 */
interface IWNat is IERC20 {
    /**
     * @notice Deposit native tokens and mint wrapped tokens
     */
    function deposit() external payable;

    /**
     * @notice Deposit native tokens and mint wrapped tokens to recipient
     */
    function depositTo(address recipient) external payable;

    /**
     * @notice Burn wrapped tokens and withdraw native tokens
     */
    function withdraw(uint256 amount) external;

    /**
     * @notice Burn wrapped tokens and withdraw native tokens to recipient
     */
    function withdrawTo(address recipient, uint256 amount) external;

    /**
     * @notice Delegate vote power to a data provider
     * @param _to Address of the data provider
     * @param _bips Percentage in basis points (10000 = 100%)
     */
    function delegate(address _to, uint256 _bips) external;

    /**
     * @notice Undelegate all vote power
     */
    function undelegateAll() external;

    /**
     * @notice Get current vote power of an address
     */
    function votePowerOf(address _owner) external view returns (uint256);

    /**
     * @notice Get delegation information
     */
    function delegatesOf(address _owner) external view returns (address[] memory, uint256[] memory);
}
