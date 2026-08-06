// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITeeExtensionRegistry} from "./ITeeExtensionRegistry.sol";

/**
 * @title IInstructionSender
 * @notice Interface for sending instructions to FCE extensions via TeeExtensionRegistry
 * @dev Corrected to match actual TeeExtensionRegistry.sendInstructions signature
 */
interface IInstructionSender {
    event InstructionSent(bytes32 indexed instructionId, ITeeExtensionRegistry.TeeInstructionParams params);

    /**
     * @notice Send an instruction to a TEE extension
     * @param params Instruction parameters (opType, opCommand, message, cosigners, etc.)
     * @return instructionId Generated instruction ID (bytes32, not uint256)
     */
    function sendInstructions(
        ITeeExtensionRegistry.TeeInstructionParams calldata params
    ) external payable returns (bytes32 instructionId);

    /**
     * @notice Set extension ID by self-discovering from registry
     * @dev Must be called after extension is registered
     */
    function setExtensionId() external;

    /**
     * @notice Get the current extension ID
     */
    function extensionId() external view returns (uint256);
}
