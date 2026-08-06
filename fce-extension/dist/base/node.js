/**
 * Client for the tee-node signing API.
 *
 * --- DO NOT MODIFY: infrastructure code. ---
 *
 * tee-node exposes crypto operations on http://localhost:$SIGN_PORT
 * (docs/extension-contract.md §3). Because tee-node is Go and Go marshals
 * []byte as base64 in JSON, the payloads here are base64 — NOT hex like the
 * rest of the wire format. That mismatch is the most common porting mistake,
 * which is why this lives in base/ rather than being hand-rolled per extension.
 */
const DEFAULT_TIMEOUT_MS = 30_000;
export class NodeClient {
    signPort;
    timeoutMs;
    constructor(signPort, timeoutMs = DEFAULT_TIMEOUT_MS) {
        this.signPort = Number(signPort);
        this.timeoutMs = timeoutMs;
    }
    get baseUrl() {
        return `http://localhost:${this.signPort}`;
    }
    /**
     * Decrypt a payload encrypted to this TEE's public key.
     * Throws if the node rejects or is unreachable.
     */
    async decrypt(ciphertext) {
        const resp = await this.post("/decrypt", {
            encryptedMessage: Buffer.from(ciphertext).toString("base64"),
        });
        const encoded = resp.decryptedMessage;
        if (encoded === undefined) {
            throw new Error("node response missing decryptedMessage");
        }
        return new Uint8Array(Buffer.from(encoded, "base64"));
    }
    async post(path, payload) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const res = await fetch(`${this.baseUrl}${path}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`node returned ${res.status} for ${path}: ${text}`);
            }
            return await res.json();
        }
        catch (e) {
            if (e instanceof Error && e.name === "AbortError") {
                throw new Error(`node request to ${path} timed out after ${this.timeoutMs}ms`);
            }
            throw e;
        }
        finally {
            clearTimeout(timer);
        }
    }
}
