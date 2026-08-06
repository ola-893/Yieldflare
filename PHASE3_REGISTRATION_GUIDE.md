# Phase 3: Extension Registration - Complete Guide

## Overview

Register the FCE extension with TeeExtensionRegistry and configure the scaffold.

## Prerequisites

- Phase 2 complete (InstructionSender deployed)
- InstructionSender address from deployment
- ngrok or cloudflared installed
- Flare support contact for indexer DB credentials

## Step-by-Step Instructions

### Step 1: Clone FCE Extension Scaffold

```bash
cd ~/Documents/hackathons
git clone https://github.com/flare-foundation/fce-extension-scaffold.git
cd fce-extension-scaffold

# Verify you're on the latest version
git pull origin main
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
nano .env
```

Required values in `.env`:

```bash
# Your deployment private key
DEPLOYMENT_PRIVATE_KEY=0x...

# Your wallet address (owner)
INITIAL_OWNER=0x...

# Coston2 RPC
CHAIN_URL=https://coston2-api.flare.network/ext/C/rpc

# Mode settings
LOCAL_MODE=false
SIMULATED_TEE=true

# Your InstructionSender from Phase 2
INSTRUCTION_SENDER=0x...  # From Phase 2 deployment

# Indexer database (get from Flare support)
INDEXER_HOST=34.38.42.208
INDEXER_PORT=3306
INDEXER_DATABASE=indexer
INDEXER_USERNAME=<GET_FROM_FLARE>
INDEXER_PASSWORD=<GET_FROM_FLARE>
```

### Step 3: Configure Extension Proxy

```bash
# Copy proxy config template
cp config/proxy/extension_proxy.coston2.docker.toml.example \
   config/proxy/extension_proxy.coston2.docker.toml

# Edit with your indexer credentials
nano config/proxy/extension_proxy.coston2.docker.toml
```

Update the `[db]` section:

```toml
[db]
host = "34.38.42.208"
port = 3306
database = "indexer"
username = "YOUR_USERNAME_FROM_FLARE"
password = "YOUR_PASSWORD_FROM_FLARE"
```

### Step 4: Install TypeScript Extension Handler

```bash
# Copy our handler to the scaffold
cp ../flare_yield_manager/fce-config/handlers.ts \
   typescript/src/app/handlers.ts

# Install dependencies
cd typescript
npm install
cd ..
```

### Step 5: Start ngrok Tunnel

In a **separate terminal**:

```bash
# Start ngrok on port 6674
ngrok http 6674

# Or with cloudflared:
# cloudflared tunnel --url localhost:6674
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

Update `.env`:
```bash
EXT_PROXY_URL=https://abc123.ngrok.io
```

**Important:** Keep this terminal running!

### Step 6: Request Indexer Database Credentials

Contact Flare support:

**Telegram:** https://t.me/FlareNetwork  
**Discord:** https://discord.gg/flarenetwork  
**Email:** support@flare.network

Message template:
```
Hi Flare team,

I'm developing an FCE extension on Coston2 and need indexer database credentials.

My InstructionSender address: 0x...
Extension purpose: Vault yield optimization
Database: indexer@34.38.42.208:3306

Please provide read-only username and password.

Thank you!
```

### Step 7: Deploy and Register Extension

Once you have DB credentials:

```bash
# This does everything:
# 1. Compiles TypeScript extension
# 2. Deploys InstructionSender (or uses existing)
# 3. Registers extension on TeeExtensionRegistry
# 4. Prints extension ID

./scripts/pre-build.sh
```

Expected output:
```
✓ Compiling TypeScript extension...
✓ Building contracts...
✓ Deploying InstructionSender: 0x...
✓ Registering extension...
✓ Extension registered!

Extension ID: 65537 (0x10001)
InstructionSender: 0x...
```

**Save the Extension ID!**

### Step 8: Verify Registration

```bash
# Check extension was registered
cast call 0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE \
  "getTeeExtensionInstructionsSender(uint256)(address)" \
  65537 \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Should return your InstructionSender address
```

### Step 9: Set Extension ID

```bash
# Get your InstructionSender address
INSTRUCTION_SENDER="0x..."  # From Phase 2

# Call setExtensionId() to self-discover
cast send $INSTRUCTION_SENDER \
  "setExtensionId()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY

# Verify it was set
cast call $INSTRUCTION_SENDER \
  "extensionId()(uint256)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Should return: 65537 (or your extension ID)
```

### Step 10: Start TEE Services

```bash
# Start Docker services (redis, ext-proxy, tee-node)
./scripts/start-services.sh --chain coston2

# Wait for services to be healthy
until curl -sf http://localhost:6674/info >/dev/null 2>&1; do
    echo "Waiting for ext-proxy..."
    sleep 2
done

echo "✓ Services ready!"
```

### Step 11: Post-Registration Setup

```bash
# Allow TEE version, set governance, register TEE machine
./scripts/post-build.sh

# Get TEE signing address
TEE_ADDRESS=$(curl -s http://localhost:6674/info | jq -r '.teeAddress')
echo "TEE Address: $TEE_ADDRESS"
```

### Step 12: Update ParentVault

```bash
# Set TEE address in ParentVault
PARENT_VAULT="0x..."  # Your deployed vault

cast send $PARENT_VAULT \
  "setTeeAddress(address)" $TEE_ADDRESS \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY

# Verify instruction sender is set
cast call $PARENT_VAULT \
  "instructionSender()(address)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Should return your InstructionSender address
```

## Verification Checklist

After completing all steps:

```bash
# 1. Extension registered
cast call 0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE \
  "getTeeExtensionInstructionsSender(uint256)(address)" \
  $EXTENSION_ID \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
# Returns: InstructionSender address ✓

# 2. Extension ID set
cast call $INSTRUCTION_SENDER "extensionId()(uint256)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
# Returns: 65537 (your ID) ✓

# 3. Services running
curl http://localhost:6674/info
# Returns: {"teeAddress": "0x...", ...} ✓

# 4. Ngrok tunnel active
curl $EXT_PROXY_URL/info
# Returns: same as localhost ✓

# 5. TEE address set in vault
cast call $PARENT_VAULT "teeAddress()(address)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
# Returns: TEE address ✓
```

## Troubleshooting

### "Extension ID not found" when calling setExtensionId()
- Extension not registered yet
- Run `./scripts/pre-build.sh` first
- Check registry with `getTeeExtensionInstructionsSender()`

### "Cannot connect to database" in ext-proxy logs
- Indexer credentials not set or incorrect
- Contact Flare support for credentials
- Verify config/proxy/extension_proxy.coston2.docker.toml

### "Services won't start" or Docker errors
- Check Docker is running: `docker ps`
- Check ports 6674, 6379 are free: `lsof -i :6674`
- View logs: `docker logs <container_name>`

### "ngrok tunnel disconnected"
- Free ngrok tunnels expire every 8 hours
- Restart ngrok and update EXT_PROXY_URL
- Consider paid ngrok or cloudflared

### "TEE signature verification failed" later
- TEE address not set in ParentVault
- Run: `vault.setTeeAddress($TEE_ADDRESS)`
- Verify: `vault.teeAddress()` returns correct address

## Configuration Files Reference

### Required Files to Create/Copy

1. **fce-extension-scaffold/.env**
   - Source: `fce-config/.env.example`
   - Fill in: PRIVATE_KEY, OWNER, INSTRUCTION_SENDER, DB credentials

2. **fce-extension-scaffold/config/proxy/extension_proxy.coston2.docker.toml**
   - Source: `fce-config/extension_proxy.coston2.toml`
   - Fill in: DB username/password

3. **fce-extension-scaffold/typescript/src/app/handlers.ts**
   - Source: `fce-config/handlers.ts`
   - No changes needed (or customize APY logic)

## What Phase 3 Accomplishes

✅ **Extension Registered**
- InstructionSender registered on TeeExtensionRegistry
- Extension ID assigned and discovered
- Can now receive instructions

✅ **TEE Infrastructure Running**
- ext-proxy serving extension on port 6674
- tee-node simulating TEE environment
- Redis handling state/caching
- ngrok exposing to internet

✅ **Database Connected**
- Can query indexer for historical data
- APY calculations can access chain state
- TWAP windows calculable

✅ **Vault Configured**
- TEE address set for signature verification
- InstructionSender connected
- Ready to send/receive rebalance instructions

## Next: Phase 4 & 5

Phase 3 sets up infrastructure. Phases 4-5 are:
- **Phase 4:** Implement real APY calculation logic
- **Phase 5:** End-to-end testing with actual rebalance

---

**Time Estimate:** 2-3 hours (waiting on DB credentials is main delay)  
**Main Blocker:** Indexer database credentials from Flare support  
**Can Start Now:** Steps 1-5, 7 (everything except DB-dependent steps)
