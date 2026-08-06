// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IParentVault} from "../../src/interfaces/IParentVault.sol";

/**
 * @title RebalanceTestHelper
 * @notice Helper for encoding/signing rebalance payloads in new ActionResult format
 */
library RebalanceTestHelper {
    bytes32 private constant TEE_ACTION_RESULT_PREFIX = bytes32("TEE_ACTION_RESULT");

    /**
     * @notice Encode a RebalancePayload as resultData
     * @dev Encodes only the business payload fields (7 fields)
     *      Signature is passed separately to executeRebalance()
     */
    function encodeRebalancePayload(
        IParentVault.RebalancePayload memory payload
    ) internal pure returns (bytes memory) {
        return abi.encode(
            payload.newStrategy,
            payload.minAmountOut,
            payload.nonce,
            payload.deadline,
            payload.twapStart,
            payload.twapEnd,
            payload.strategyDataHash
            // NO signature field - it's not part of resultData
        );
    }

    /**
     * @notice Compute the ActionResult hash that TEE signs
     */
    function computeActionResultHash(
        bytes memory resultData,
        bytes32 actionId,
        string memory submissionTag,
        uint8 status
    ) internal view returns (bytes32) {
        // Layer 1: resultHash from components
        bytes32 resultHash = keccak256(abi.encodePacked(
            keccak256(resultData),
            actionId,
            keccak256(bytes(submissionTag)),
            status
        ));

        // Layer 2: payloadHash with domain separation
        bytes32 payloadHash = keccak256(abi.encode(
            TEE_ACTION_RESULT_PREFIX,
            block.chainid,
            resultHash
        ));

        // Layer 3: EIP-191 personal_sign wrapper
        return keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            payloadHash
        ));
    }
}
