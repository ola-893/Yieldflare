# FlareYield Manager - For Tester

## 🎯 One-Command Setup

**Clone the repo and start everything:**

```bash
git clone https://github.com/OlaMueller/flare-yield-manager.git
cd flare-yield-manager
npm run install:all
./start-all.sh
```

**That's it!** 🎉 The frontend will open at http://localhost:5173

## 📋 Prerequisites You Need

1. **Docker Desktop** - https://www.docker.com/products/docker-desktop
2. **Node.js 18+** - https://nodejs.org/
3. **MetaMask** - For wallet connection

## 🔧 Configuration Required

Before running `./start-all.sh`, you may need to update ONE file:

**`fce-extension-scaffold/.env`**
- Contact me for DB credentials and NGROK token
- Or check if it's already configured

All other `.env` files are pre-configured for Coston2 testnet.

## 🧪 Test Flow

1. **Start**: `./start-all.sh` (wait ~10 seconds)
2. **Open**: http://localhost:5173
3. **Connect wallet**: MetaMask → Switch to Coston2 (Chain ID: 114)
4. **Get test tokens**:
   - CFLR: https://faucet.flare.network/coston2
   - XRP: https://xrpl.org/resources/dev-tools/xrp-faucets
5. **Make a deposit**: Follow the UI
6. **Watch it work**: UI shows executor processing → settlement → shares received

## 🛑 Stop Everything

```bash
./start-all.sh --stop
```

## 📖 Need Help?

- **Full guide**: [TESTER_SETUP_GUIDE.md](./TESTER_SETUP_GUIDE.md)
- **Quick reference**: [QUICK_START.md](./QUICK_START.md)
- **Logs**: `tail -f *.log` (in project root)
- **Issues?**: Send me the error logs

## 🔗 What You're Testing

- ✅ XRPL → Flare FAsset deposits
- ✅ Off-chain executor automation
- ✅ FCE-secured settlement signing
- ✅ Multi-strategy yield vault
- ✅ Modern React UI

## 📞 Quick Checks

**Is it running?**
```bash
# Check frontend
curl http://localhost:5173

# Check FCE extension
curl http://localhost:8080/health

# Check Docker
cd fce-extension-scaffold && docker compose ps
```

**View logs in real-time:**
```bash
tail -f executor.log fce-extension.log frontend.log
```

---

**🚀 Ready? Run `./start-all.sh` and visit http://localhost:5173!**
