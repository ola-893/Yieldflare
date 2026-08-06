// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITeeExtensionRegistry
 * @notice Interface for Flare's TEE Extension Registry
 * @dev Verified against fce-extension-scaffold contracts/interfaces/ITeeExtensionRegistry.sol
 */
interface ITeeExtensionRegistry {
    struct TeeInstructionParams {
        bytes32 opType;
        bytes32 opCommand;
        bytes message;
        address[] cosigners;
        uint64 cosignersThreshold;
        address claimBackAddress;
    }

    event InstructionSent(
        bytes32 indexed instructionId,
        uint256 indexed extensionId,
        address indexed instructionSender,
        TeeInstructionParams params
    );

    /**
     * @notice Send instructions to TEE extension
     * @param teeIds Array of TEE machine addresses to send to
     * @param params Instruction parameters
     * @return instructionId Generated instruction ID (bytes32)
     */
    function sendInstructions(
        address[] memory teeIds,
        TeeInstructionParams calldata params
    ) external payable returns (bytes32 instructionId);

    /**
     * @notice Get the instruction sender address for an extension
     * @param extensionId Extension ID
     * @return Instruction sender address
     */
    function getTeeExtensionInstructionsSender(uint256 extensionId) external view returns (address);

    /**
     * @notice Get next available public extension ID
     * @return Next extension ID
     */
    function nextPublicExtensionId() external view returns (uint256);
}
