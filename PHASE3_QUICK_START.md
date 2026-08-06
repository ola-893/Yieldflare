# Phase 3: Quick Start Guide

## Prerequisites
- [ ] Phase 2 deployed (InstructionSender address)
- [ ] ngrok or cloudflared installed
- [ ] Docker running

## 30-Minute Setup (Without DB Credentials)

```bash
# 1. Clone scaffold
cd ~/Documents/hackathons
git clone https://github.com/flare-foundation/fce-extension-scaffold.git
cd fce-extension-scaffold

# 2. Configure .env
cp .env.example .env
# Edit: DEPLOYMENT_PRIVATE_KEY, INITIAL_OWNER, INSTRUCTION_SENDER

# 3. Copy handler
cp ../flare_yield_manager/fce-config/handlers.ts typescript/src/app/handlers.ts
cd typescript && npm install && cd ..

# 4. Start ngrok (separate terminal)
ngrok http 6674
# Add URL to .env: EXT_PROXY_URL=https://...

# 5. Register extension
./scripts/pre-build.sh
# Save Extension ID from output

# 6. Set extension ID
cast send $INSTRUCTION_SENDER "setExtensionId()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY
```

## What Works Without DB Credentials

✅ Extension registration  
✅ Extension ID discovery  
✅ Service startup (with placeholder DB config)  
✅ TEE address generation  
✅ Basic instruction handling  

❌ Can't query indexer for real APY data  
❌ Can't calculate historical TWAP  

## When You Get DB Credentials

```bash
# 1. Update config
nano config/proxy/extension_proxy.coston2.docker.toml
# Fill in [db] username and password

# 2. Restart services
docker-compose down
./scripts/start-services.sh --chain coston2

# 3. Test database connection
docker logs extension-proxy | grep "database"
# Should see: "Connected to indexer database"
```

## Request DB Credentials

**Flare Support:**
- Telegram: https://t.me/FlareNetwork
- Discord: https://discord.gg/flarenetwork  
- Email: support@flare.network

**Message:**
```
Hi, I need indexer DB credentials for Coston2 FCE development.
InstructionSender: 0x...
Purpose: Vault yield optimization
Database: indexer@34.38.42.208:3306
```

## Verification Commands

```bash
# Extension registered?
cast call 0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE \
  "getTeeExtensionInstructionsSender(uint256)(address)" \
  $EXTENSION_ID --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Extension ID set?
cast call $INSTRUCTION_SENDER "extensionId()(uint256)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Services running?
curl http://localhost:6674/info

# TEE address set in vault?
cast call $PARENT_VAULT "teeAddress()(address)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

## Common Issues

| Issue | Solution |
|-------|----------|
| "Extension ID not found" | Run pre-build.sh first |
| "Port 6674 in use" | Kill process: `lsof -ti:6674 \| xargs kill` |
| "Docker won't start" | Check Docker running: `docker ps` |
| "ngrok disconnected" | Restart and update EXT_PROXY_URL |
| "DB connection failed" | Normal without credentials |

## Files to Configure

1. **`.env`** - Deployment config
2. **`config/proxy/extension_proxy.coston2.docker.toml`** - DB credentials  
3. **`typescript/src/app/handlers.ts`** - Extension logic

## Next Steps After Phase 3

1. Update ParentVault: `setTeeAddress($TEE_ADDRESS)`
2. Test end-to-end: Send rebalance instruction
3. Implement real APY logic (Phase 4)

---

**Time:** 30 min (setup) + wait for DB credentials  
**Cost:** Free (ngrok free tier, Coston2 C2FLR)  
**Blockers:** Indexer DB credentials (request ASAP)
