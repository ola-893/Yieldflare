/**
 * Wire types and the handler registry.
 *
 * --- DO NOT MODIFY: infrastructure code. ---
 *
 * Field names and encodings are fixed by docs/extension-contract.md §4.
 */
import { stringToBytes32Hex } from "./encoding.js";
export const EMPTY_BYTES32 = stringToBytes32Hex("");
/** Maps (opType, opCommand) bytes32 pairs to handlers (contract §5). */
export class Framework {
    handlers = [];
    /**
     * Register a handler. Both identifiers are given as plain strings and
     * converted to bytes32. Pass "" for opCommand to make this the default for
     * every command under opType.
     */
    handle(opType, opCommand, handler) {
        this.handlers.push([
            stringToBytes32Hex(opType),
            stringToBytes32Hex(opCommand),
            handler,
        ]);
    }
    /** Exact (opType, opCommand) match first, then the opCommand wildcard. */
    lookup(opType, opCommand) {
        const t = normalize(opType);
        const c = normalize(opCommand);
        for (const [regType, regCmd, handler] of this.handlers) {
            if (regType === t && regCmd === c)
                return handler;
        }
        for (const [regType, regCmd, handler] of this.handlers) {
            if (regType === t && regCmd === EMPTY_BYTES32)
                return handler;
        }
        return null;
    }
}
/** Lowercase and 0x-prefix a hex identifier so comparisons are stable. */
function normalize(h) {
    if (!h)
        return EMPTY_BYTES32;
    const lower = h.toLowerCase();
    return lower.startsWith("0x") ? lower : `0x${lower}`;
}
