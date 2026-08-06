# Request: Indexer Database Credentials

**Date:** August 6, 2026  
**Extension ID:** 0x101b3 (65971)  
**InstructionSender:** 0xB4b31E86F020Cf7F1B81B35C2E2Bd2CF6DA1BE66  
**Chain:** Coston2 (114)

---

## Extension Registration Completed

Our FCE extension has been successfully registered on Coston2:

- **Extension ID:** 0x00000000000000000000000000000000000000000000000000000000000101b3
- **InstructionSender Address:** 0xB4b31E86F020Cf7F1B81B35C2E2Bd2CF6DA1BE66
- **Verification:** On-chain self-discovery confirmed via `setExtensionId()` call

## Request: Database Credentials

We need indexer database credentials to complete our extension setup. According to the [fce-extension-scaffold documentation](https://github.com/flare-foundation/fce-extension-scaffold), these credentials should be requested from Flare support.

**Required credentials for `extension_proxy.toml`:**

```toml
[database]
host = "34.38.42.208"  # Default from docs
port = 3306
username = "???"  # Need from Flare support
password = "???"  # Need from Flare support
database = "indexer"
```

## Our Extension Purpose

FlareYield Manager vault rebalancing:
- **Operation:** VAULT_REBALANCE / CALCULATE_OPTIMAL
- **Function:** Calculate optimal yield strategy allocation based on historical APY data
- **Use case:** Automated vault rebalancing with TEE-verified decisions

## Contact Information

- **GitHub:** (your github username)
- **Email:** (your email)
- **Project:** FlareYield Manager (Flare Hackathon submission)

## Next Steps After Receiving Credentials

Once credentials are received, we will:
1. Update `extension_proxy.coston2.toml` with DB config
2. Start TEE services: `./scripts/start-services.sh --chain coston2`
3. Test end-to-end instruction flow
4. Update ParentVault with InstructionSender address

---

## Where to Send This Request

**Options:**
1. **Flare Discord:** #fce-developers or #support channel
2. **Flare Telegram:** Technical support group
3. **GitHub Issues:** fce-extension-scaffold repository
4. **Email:** support@flare.network (if available)

**Suggested message:**

> Hi Flare team,
> 
> I've successfully registered an FCE extension on Coston2:
> - Extension ID: 0x101b3
> - InstructionSender: 0xB4b31E86F020Cf7F1B81B35C2E2Bd2CF6DA1BE66
> 
> Per the scaffold documentation, I need indexer database credentials to complete the setup. Could you provide:
> - Database username
> - Database password
> 
> For host 34.38.42.208:3306, database "indexer" (Coston2).
> 
> This is for a FlareYield Manager extension that calculates optimal vault strategies based on historical APY data.
> 
> Thank you!
