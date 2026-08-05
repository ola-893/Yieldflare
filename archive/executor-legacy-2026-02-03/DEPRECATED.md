# ⚠️ DEPRECATED

**Date Archived:** February 3, 2026  
**Status:** Obsolete

---

## This Executor is Deprecated

This Node.js executor has been **replaced** by the **FCE Extension** (`fce-extension/`).

### Why Deprecated?

1. **Security:** Private key exposed on server (no TEE protection)
2. **Functionality:** Only handled XRPL bridging (no rebalancing)
3. **MEV Risk:** No protection against front-running
4. **Architecture:** Not integrated with Flare Confidential Compute

### Replacement

See `fce-extension/` for the new implementation:

```
fce-extension/
├── src/app/handlers.ts   # Autonomous rebalancing
├── src/app/abi.ts        # Contract interfaces
├── src/app/config.ts     # Configuration
└── README.md             # Documentation
```

### What This Code Did

- Watched XRPL testnet for payments
- Processed direct mint transactions
- Bridged XRPL → Flare via FAssetAdapter

### Migration Guide

See `/EXECUTOR_MIGRATION.md` for details.

---

**Do not use this code in production.**

Use `fce-extension/` instead.
