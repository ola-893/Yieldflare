# Coston2 FCC Redeploy Status Check

**Date:** August 6, 2026  
**Context:** Coston2 FCC was redeployed on July 22, 2024. Checking if our extension survived.

---

## Our Extension Status

**Extension ID:** 0x101b3 (65971)  
**InstructionSender:** 0xB4b31E86F020Cf7F1B81B35C2E2Bd2CF6DA1BE66

### Verification

```bash
cast call 0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE \
  "getTeeExtensionInstructionsSender(uint256)(address)" 65971 \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

**Result:** `0xB4b31E86F020Cf7F1B81B35C2E2Bd2CF6DA1BE66`

✅ **Extension registration survived the redeploy.**

---

## FlareTeeManager Address

**Current (post-redeploy):** `0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE`  
**Old (dead since July 22):** `0x004224fa...5d41F`

✅ **Our InstructionSender uses the correct, current address.**

---

## Scaffold Version Check

**Current scaffold commit:** `f48cafb` (latest main)  
**tee-node version:** `v0.0.21`

⚠️ **Warning:** Message indicates tee-node ≥ v0.0.22 required. Our scaffold has v0.0.21.

**Impact:** Older versions get data-provider votes rejected, main queue stays empty forever.

---

## What We Need to Do

### Before Starting TEE Services

1. **Wait for DB credentials** (GitHub issue #4 filed)
2. **Update scaffold to latest** (if tee-node v0.0.22+ released):
   ```bash
   cd fce-extension-scaffold
   git pull origin main
   cd tools && go mod tidy
   ```

3. **Copy our handler code**:
   ```bash
   cp ../fce-config/handlers.ts typescript/src/app/
   cp ../fce-config/apy-calculator.ts typescript/src/app/
   ```

4. **Update DB config** in `config/proxy/extension_proxy.toml` (once credentials received)

5. **Use named tunnel** (not trycloudflare quick tunnel):
   - Named cloudflared tunnel, OR
   - Reserved ngrok domain
   - Reason: Quick tunnel hostnames change on restart → machines stuck at INITIALIZED

### After Starting TEE Services

6. **Register TEE machine** with fresh challenge:
   ```bash
   cd tools
   go run ./cmd/register-tee -command rRap
   # Capital R = fresh challenge (redeploy might have wiped registrations)
   ```

7. **Verify TEE state**:
   ```bash
   # Check URL matches what we're serving
   cast call 0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE \
     "getTeeMachine(address)((address,address,string))" $TEE_ADDRESS
   
   # Check status (1 = INITIALIZED, 2 = PRODUCTION)
   cast call 0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE \
     "getTeeMachineStatus(address)(uint8)" $TEE_ADDRESS
   ```

8. **Update ParentVault** with TEE address:
   ```bash
   cast send 0x01f64160E4928Eba5607aE294F9B66090Dc323B3 \
     "setTeeAddress(address)" $TEE_ADDRESS \
     --rpc-url $COSTON2_RPC --private-key $PRIVATE_KEY
   ```

---

## Important Notes

### SIMULATED_TEE on Coston2

✅ **SIMULATED_TEE=true is fine for judging.** GCP Confidential Space NOT required.

### Indexer DB Credentials

⚠️ **Old indexer-reader credentials in earlier docs are dead.**

New credentials should be in pinned message (once we get them from GitHub issue response).

### Guides Out of Date

Documentation is catching up to the redeploy. Follow the checklist above instead of old guides.

---

## Current Blockers

1. **DB credentials** — waiting on GitHub issue #4 response
2. **tee-node version** — scaffold has v0.0.21, need ≥ v0.0.22 (may need scaffold update)

---

## What's Already Working

✅ Extension registered and survived redeploy  
✅ InstructionSender pointing to correct FlareTeeManager  
✅ ParentVault wired to InstructionSender  
✅ Scaffold on latest main  

**Next:** Wait for DB credentials, then follow checklist above.
