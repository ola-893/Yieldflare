// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISparkDexFactory
 * @notice Interface for SparkDEX V2 Factory
 * @dev Factory Address on Coston2: 0x16b619B04c961E8f4F06C10B42FDAbb328980A89
 */
interface ISparkDexFactory {
    event PairCreated(address indexed token0, address indexed token1, address pair, uint256);

    function feeTo() external view returns (address);
    function feeToSetter() external view returns (address);

    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function allPairs(uint256) external view returns (address pair);
    function allPairsLength() external view returns (uint256);

    function createPair(address tokenA, address tokenB) external returns (address pair);

    function setFeeTo(address) external;
    function setFeeToSetter(address) external;
}
