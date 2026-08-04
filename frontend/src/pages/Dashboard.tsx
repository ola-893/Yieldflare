import React, {useState} from 'react';
import {useAccount, useBalance, useReadContract} from 'wagmi';
import {formatUnits} from 'viem';
import {motion} from 'motion/react';
import {TrendingUp, Layers, Clock, ArrowUpRight, ArrowDownRight, Wallet, RefreshCw, Zap, ShieldCheck, Copy, Check, ChevronRight, ArrowRight, Cpu, Lock, Server, Coins} from 'lucide-react';
import xrpImg from '../assets/images/xrp.webp';
import {CONTRACTS, PARENT_VAULT_ABI} from '../config/contracts';
import {StrategiesModal} from '../components/StrategiesModal';

const PARENT_VAULT_ADDRESS: `0x${string}` = CONTRACTS.parentVault;
const CDP_VAULT_ADDRESS: `0x${string}` = CONTRACTS.vaults.cdpVault;

interface DashboardProps {
  onNavigateToDeposit: () => void;
  onNavigateToWithdraw: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({onNavigateToDeposit, onNavigateToWithdraw}) => {
  const {address, isConnected} = useAccount();
  const {data: nativeBalance} = useBalance({address});
  const [copied, setCopied] = useState(false);
  const [showStrategiesModal, setShowStrategiesModal] = useState(false);

  // Check if contract address is deployed (not zero address)
  const isDeployed = PARENT_VAULT_ADDRESS !== '0x0000000000000000000000000000000000000000';
  const isCdpDeployed = CDP_VAULT_ADDRESS !== '0x0000000000000000000000000000000000000000';

  // Read vault data
  const {data: totalAssets} = useReadContract({
    address: PARENT_VAULT_ADDRESS,
    abi: PARENT_VAULT_ABI,
    functionName: 'totalAssets',
    query: {enabled: isDeployed},
  });

  const {data: totalSupply} = useReadContract({
    address: PARENT_VAULT_ADDRESS,
    abi: PARENT_VAULT_ABI,
    functionName: 'totalSupply',
    query: {enabled: isDeployed},
  });

  const {data: userShares} = useReadContract({
    address: PARENT_VAULT_ADDRESS,
    abi: PARENT_VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {enabled: isDeployed && !!address},
  });

  const {data: activeStrategy} = useReadContract({
    address: PARENT_VAULT_ADDRESS,
    abi: PARENT_VAULT_ABI,
    functionName: 'activeStrategy',
    query: {enabled: isDeployed},
  });

  const {data: vaultDecimals} = useReadContract({
    address: PARENT_VAULT_ADDRESS,
    abi: PARENT_VAULT_ABI,
    functionName: 'decimals',
    query: {enabled: isDeployed},
  });
  const decimals = vaultDecimals ?? 18;

  // Calculate values
  const sharePrice = totalAssets && totalSupply && totalSupply > 0n
    ? Number(formatUnits(totalAssets, decimals)) / Number(formatUnits(totalSupply, decimals))
    : 1;
  const userShareBalance = userShares ? Number(formatUnits(userShares, decimals)) : 0;
  const userValueUsd = userShareBalance * sharePrice;
  const totalAssetsFormatted = totalAssets ? Number(formatUnits(totalAssets, decimals)) : 0;

  // Check if strategy is active
  const hasActiveStrategy = activeStrategy && activeStrategy !== '0x0000000000000000000000000000000000000000';

  // Strategy info mapping
  const getStrategyInfo = (addr: string | undefined): {name: string; description: string; apy: string} => {
    if (!addr || addr === '0x0000000000000000000000000000000000000000') {
      return {name: 'Awaiting Deployment', description: 'Deposit FXRP to activate automatic yield generation', apy: 'N/A'};
    }
    const strategies: Record<string, {name: string; description: string; apy: string}> = {
      [CONTRACTS.strategies.ftsoV2Delegation]: {
        name: 'FTSO v2 Delegation',
        description: 'Supporting Flare oracle network',
        apy: '3-8%'
      },
      [CONTRACTS.strategies.sparkDexLp]: {
        name: 'SparkDEX LP',
        description: 'Earning DEX trading fees',
        apy: '5-15%'
      },
      [CONTRACTS.strategies.smartAccountDirectMint]: {
        name: 'Smart Account Direct Mint',
        description: 'Optimized FAsset minting',
        apy: '2-5%'
      },
      [CONTRACTS.strategies.enosysFxrp]: {
        name: 'Enosys DEX FXRP',
        description: 'Cross-chain liquidity',
        apy: '8-14%'
      },
      [CONTRACTS.strategies.enosysCdpLp]: {
        name: 'Enosys CDP LP',
        description: 'CDP/WC2FLR concentrated liquidity',
        apy: '8-20%'
      },
    };
    if (strategies[addr]) return strategies[addr];
    return {name: 'Active Strategy', description: 'Yield generation active', apy: 'N/A'};
  };

  const strategyInfo = getStrategyInfo(activeStrategy);

  // ─── CDP Vault Reads ──────────────────────────────────────────────────────
  const {data: cdpTotalAssets} = useReadContract({
    address: CDP_VAULT_ADDRESS,
    abi: PARENT_VAULT_ABI,
    functionName: 'totalAssets',
    query: {enabled: isCdpDeployed},
  });

  const {data: cdpTotalSupply} = useReadContract({
    address: CDP_VAULT_ADDRESS,
    abi: PARENT_VAULT_ABI,
    functionName: 'totalSupply',
    query: {enabled: isCdpDeployed},
  });

  const {data: cdpUserShares} = useReadContract({
    address: CDP_VAULT_ADDRESS,
    abi: PARENT_VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {enabled: isCdpDeployed && !!address},
  });

  const {data: cdpActiveStrategy} = useReadContract({
    address: CDP_VAULT_ADDRESS,
    abi: PARENT_VAULT_ABI,
    functionName: 'activeStrategy',
    query: {enabled: isCdpDeployed},
  });

  const {data: cdpVaultDecimals} = useReadContract({
    address: CDP_VAULT_ADDRESS,
    abi: PARENT_VAULT_ABI,
    functionName: 'decimals',
    query: {enabled: isCdpDeployed},
  });
  const cdpDecimals = cdpVaultDecimals ?? 18;

  // Calculate CDP values
  const cdpSharePrice = cdpTotalAssets && cdpTotalSupply && cdpTotalSupply > 0n
    ? Number(formatUnits(cdpTotalAssets, cdpDecimals)) / Number(formatUnits(cdpTotalSupply, cdpDecimals))
    : 1;
  const cdpUserShareBalance = cdpUserShares ? Number(formatUnits(cdpUserShares, cdpDecimals)) : 0;
  const cdpTotalAssetsFormatted = cdpTotalAssets ? Number(formatUnits(cdpTotalAssets, cdpDecimals)) : 0;
  const cdpHasActiveStrategy = cdpActiveStrategy && cdpActiveStrategy !== '0x0000000000000000000000000000000000000000';
  const cdpStrategyInfo = getStrategyInfo(cdpActiveStrategy);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#F5F5F3] flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{opacity: 0, y: 30}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.6, ease: [0.16, 1, 0.3, 1]}}
        >
          <div className="stat-icon-ring mx-auto mb-6" style={{width: 64, height: 64, borderRadius: 20}}>
            <Wallet className="w-8 h-8" />
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-[#1E1E1E]/20 text-[10px] font-mono font-bold text-[#1E1E1E] uppercase tracking-[0.2em] mb-4 bg-white/40">
            <Wallet className="w-3.5 h-3.5 text-[#E1BAC2]" />
            <span>GET STARTED</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1E1E1E] mb-3" style={{fontFamily: 'Manrope, sans-serif'}}>
            Connect your wallet
          </h2>
          <p className="text-sm text-[#4A4A4A] max-w-sm mx-auto" style={{fontFamily: 'Hanken Grotesk, sans-serif'}}>
            Connect to view your Flux portfolio and start earning automatic yield
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F3] pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ─── Welcome Hero ─── */}
        <motion.div
          initial={{opacity: 0, y: 20}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.5, ease: [0.16, 1, 0.3, 1]}}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1E1E1E] leading-tight" style={{fontFamily: 'Manrope, sans-serif'}}>
                Welcome back
              </h1>
              <button onClick={copyAddress} className="flex items-center gap-2 mt-2 group">
                <span className="text-sm font-mono text-[#4A4A4A]">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[#4A4A4A]/50 group-hover:text-[#E1BAC2] transition-colors" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 border border-[#1E1E1E]/10 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-[#4A4A4A]">
                Coston2 Testnet
              </span>
            </div>
          </div>
          <div className="flux-divider mt-6">
            <div className="flux-divider-diamond" />
          </div>
        </motion.div>

        {/* ─── How It Works Banner ─── */}
        <motion.div
          initial={{opacity: 0, y: 20}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.5, delay: 0.1}}
          className="mb-8 p-5 rounded-3xl bg-gradient-to-r from-[#1E1E1E] to-[#2a2a2a] text-white"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E1BAC2] flex items-center justify-center shrink-0">
              <Cpu className="w-6 h-6 text-[#1E1E1E]" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold mb-2" style={{fontFamily: 'Manrope, sans-serif'}}>
                Automatic Yield Generation
              </h3>
              <p className="text-xs text-white/80 leading-relaxed mb-4">
                When you deposit FXRP, it's automatically deployed to the best-yielding strategy by the Flare Confidential Compute (FCC). The TEE monitors yields 24/7 and rebalances when better opportunities arise. Your Flux tokens accrue value automatically.
              </p>
              <div className="flex items-center gap-4 text-[10px] font-mono">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-[#E1BAC2]" />
                  <span className="text-white/70">Non-Custodial</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Server className="w-3 h-3 text-[#E1BAC2]" />
                  <span className="text-white/70">TEE-Signed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 text-[#E1BAC2]" />
                  <span className="text-white/70">Auto-Compound</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── Stats Grid ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard
            label="Your Flux Tokens"
            value={userShareBalance > 0 ? `${userShareBalance.toFixed(4)}` : '0'}
            suffix="Flux"
            subtext={userShareBalance > 0 ? `≈ ${userValueUsd.toFixed(6)} FXRP value` : 'Deposit FXRP to start'}
            icon={<Layers className="w-5 h-5" />}
            delay={0.1}
          />
          <StatCard
            label="Share Price"
            value={`${sharePrice.toFixed(6)}`}
            suffix=""
            subtext="FXRP per Flux token"
            icon={<TrendingUp className="w-5 h-5" />}
            delay={0.2}
          />
          <StatCard
            label="Total Vault"
            value={totalAssetsFormatted > 0 ? `${totalAssetsFormatted.toFixed(2)}` : '0'}
            suffix="FXRP"
            subtext="Total assets under management"
            icon={<RefreshCw className="w-5 h-5" />}
            delay={0.3}
          />
          <StatCard
            label="Gas Balance"
            value={nativeBalance ? `${parseFloat(nativeBalance.formatted).toFixed(4)}` : '—'}
            suffix="C2FLR"
            subtext="For transaction fees"
            icon={<Wallet className="w-5 h-5" />}
            delay={0.4}
          />
        </div>

        {/* ─── Active Strategy Card ─── */}
        <motion.div
          initial={{opacity: 0, y: 20}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.5, delay: 0.3}}
          className="mb-8 glass-panel p-6 sm:p-8 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial bg-white/60"
        >
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#1E1E1E]/10">
            <div className="flex items-center gap-3">
              <div className="stat-icon-ring">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1E1E1E]" style={{fontFamily: 'Manrope, sans-serif'}}>
                  Active Yield Strategy
                </h3>
                <p className="text-[10px] text-[#4A4A4A] mt-0.5">
                  Managed by Flare Confidential Compute (FCC)
                </p>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold border ${
              hasActiveStrategy 
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${hasActiveStrategy ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
              {hasActiveStrategy ? 'Earning Yield' : 'Awaiting Deposit'}
            </div>
          </div>

          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#171414] flex items-center justify-center shadow-[0_0_20px_rgba(225,186,194,0.15)]">
              <img src={xrpImg} alt="Strategy" className="w-9 h-9 object-contain" />
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-extrabold text-[#1E1E1E]" style={{fontFamily: 'Manrope, sans-serif'}}>
                {strategyInfo.name}
              </h4>
              <p className="text-sm text-[#4A4A4A] mt-1">
                {strategyInfo.description}
              </p>
              {hasActiveStrategy && (
                <p className="text-[11px] font-mono text-[#4A4A4A] mt-2 bg-[#F5F5F3] inline-block px-2 py-1 rounded">
                  {activeStrategy?.slice(0, 6)}...{activeStrategy?.slice(-4)}
                </p>
              )}
            </div>
          </div>

          {/* Warning: No Strategy Active */}
          {!hasActiveStrategy && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-800 mb-1">Strategy Not Yet Deployed</p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Your {totalAssetsFormatted.toFixed(2)} FXRP is safely held in the vault. The FCC/TEE will automatically deploy funds to the best-yielding strategy once activated. No yield is being earned until deployment occurs.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Strategy Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="p-3 rounded-xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
              <p className="text-[10px] font-mono text-[#4A4A4A] uppercase tracking-wider mb-1">Status</p>
              <p className={`text-sm font-bold ${hasActiveStrategy ? 'text-emerald-600' : 'text-amber-600'}`}>
                {hasActiveStrategy ? 'Active' : 'Idle'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
              <p className="text-[10px] font-mono text-[#4A4A4A] uppercase tracking-wider mb-1">Type</p>
              <p className="text-sm font-bold text-[#1E1E1E]">Auto-Compound</p>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
              <p className="text-[10px] font-mono text-[#4A4A4A] uppercase tracking-wider mb-1">Security</p>
              <p className="text-sm font-bold text-[#1E1E1E]">TEE-Signed</p>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
              <p className="text-[10px] font-mono text-[#4A4A4A] uppercase tracking-wider mb-1">Network</p>
              <p className="text-sm font-bold text-[#1E1E1E]">Flare Coston2</p>
            </div>
          </div>

          <button
            onClick={() => setShowStrategiesModal(true)}
            className="w-full py-3 rounded-xl bg-[#F5F5F3] border border-[#1E1E1E]/10 text-[#1E1E1E] text-[11px] font-bold uppercase tracking-[0.12em] hover:bg-[#1E1E1E] hover:text-[#E1BAC2] transition-all flex items-center justify-center gap-2"
          >
            View All Available Strategies
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>

        {/* ─── CDP Vault Card ─── */}
        {isCdpDeployed && (
          <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.5, delay: 0.35}}
            className="mb-8 glass-panel p-6 sm:p-8 rounded-3xl border border-[#E1BAC2]/30 shadow-soft-editorial bg-white/60"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#1E1E1E]/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E1BAC2]/20 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-[#E1BAC2]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E1E1E]" style={{fontFamily: 'Manrope, sans-serif'}}>
                    CDP Vault <span className="text-xs font-mono text-[#4A4A4A]">(fyCDP)</span>
                  </h3>
                  <p className="text-[10px] text-[#4A4A4A] mt-0.5">
                    Stablecoin yield via Enosys V3 CDP/WC2FLR LP
                  </p>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold border ${
                cdpHasActiveStrategy
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cdpHasActiveStrategy ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                {cdpHasActiveStrategy ? 'Earning Yield' : 'Awaiting Deposit'}
              </div>
            </div>

            {/* CDP Vault Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-3 rounded-xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
                <p className="text-[10px] font-mono text-[#4A4A4A] uppercase tracking-wider mb-1">Your fyCDP</p>
                <p className="text-sm font-bold text-[#1E1E1E]">
                  {cdpUserShareBalance > 0 ? cdpUserShareBalance.toFixed(4) : '0'}
                </p>
                <p className="text-[10px] text-[#4A4A4A] mt-0.5">
                  {cdpUserShareBalance > 0 ? `≈ ${cdpUserShareBalance.toFixed(4)} CDP` : 'Deposit CDP to start'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
                <p className="text-[10px] font-mono text-[#4A4A4A] uppercase tracking-wider mb-1">Share Price</p>
                <p className="text-sm font-bold text-[#1E1E1E]">{cdpSharePrice.toFixed(6)}</p>
                <p className="text-[10px] text-[#4A4A4A] mt-0.5">CDP per fyCDP</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
                <p className="text-[10px] font-mono text-[#4A4A4A] uppercase tracking-wider mb-1">Vault TVL</p>
                <p className="text-sm font-bold text-[#1E1E1E]">{cdpTotalAssetsFormatted > 0 ? cdpTotalAssetsFormatted.toFixed(2) : '0'}</p>
                <p className="text-[10px] text-[#4A4A4A] mt-0.5">CDP deposited</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
                <p className="text-[10px] font-mono text-[#4A4A4A] uppercase tracking-wider mb-1">Strategy</p>
                <p className="text-sm font-bold text-[#1E1E1E]">{cdpStrategyInfo.name}</p>
                <p className="text-[10px] text-emerald-600 font-bold mt-0.5">APY {cdpStrategyInfo.apy}</p>
              </div>
            </div>

            {/* CDP Strategy Info */}
            {cdpHasActiveStrategy && (
              <div className="p-4 rounded-2xl bg-[#E1BAC2]/5 border border-[#E1BAC2]/20 mb-6">
                <div className="flex items-start gap-3">
                  <Coins className="w-5 h-5 text-[#E1BAC2] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-[#1E1E1E] mb-1">{cdpStrategyInfo.name} — Active</p>
                    <p className="text-[11px] text-[#4A4A4A] leading-relaxed">
                      {cdpStrategyInfo.description}. Your CDP is deployed in a CDP/WC2FLR concentrated liquidity pool on Enosys DEX, earning trading fees.
                    </p>
                    <p className="text-[10px] font-mono text-[#4A4A4A] mt-2 bg-white/60 inline-block px-2 py-1 rounded">
                      {cdpActiveStrategy?.toString().slice(0, 6)}...{cdpActiveStrategy?.toString().slice(-4)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* CDP Warning: No Strategy */}
            {!cdpHasActiveStrategy && cdpTotalAssetsFormatted > 0 && (
              <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-800 mb-1">CDP Strategy Not Yet Deployed</p>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      Your {cdpTotalAssetsFormatted.toFixed(2)} CDP is safely held in the vault. The Enosys CDP LP strategy will be activated by the TEE once deployed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* CDP Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onNavigateToDeposit}
                className="py-3 rounded-xl bg-[#1E1E1E] text-[#E1BAC2] text-[11px] font-bold uppercase tracking-[0.12em] hover:bg-[#000000] transition-all flex items-center justify-center gap-2"
              >
                <ArrowDownRight className="w-3.5 h-3.5" />
                Deposit CDP
              </button>
              <button
                onClick={onNavigateToWithdraw}
                disabled={cdpUserShareBalance === 0}
                className="py-3 rounded-xl bg-white border border-[#1E1E1E]/15 text-[#1E1E1E] text-[11px] font-bold uppercase tracking-[0.12em] hover:border-[#E1BAC2] hover:text-[#E1BAC2] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                {cdpUserShareBalance > 0 ? 'Withdraw CDP' : 'No fyCDP'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ─── Quick Actions ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.5, delay: 0.4}}
            className="glass-panel p-6 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial bg-white/60"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="stat-icon-ring" style={{width: 36, height: 36}}>
                <ArrowDownRight className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-[#1E1E1E]" style={{fontFamily: 'Manrope, sans-serif'}}>
                Deposit FXRP
              </h3>
            </div>
            <p className="text-xs text-[#4A4A4A] mb-4" style={{fontFamily: 'Hanken Grotesk, sans-serif'}}>
              Send native XRP to mint Flux tokens. Your deposit is automatically deployed to the best-yielding strategy by the FCC.
            </p>
            <button
              onClick={onNavigateToDeposit}
              className="w-full py-3.5 rounded-full bg-[#171414] text-[#E1BAC2] text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-[#000000] transition-all shadow-md flex items-center justify-center gap-2"
            >
              <ArrowDownRight className="w-4 h-4" />
              Deposit Now
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>

          <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.5, delay: 0.5}}
            className="glass-panel p-6 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial bg-white/60"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="stat-icon-ring" style={{width: 36, height: 36}}>
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-[#1E1E1E]" style={{fontFamily: 'Manrope, sans-serif'}}>
                Withdraw Flux
              </h3>
            </div>
            <p className="text-xs text-[#4A4A4A] mb-4" style={{fontFamily: 'Hanken Grotesk, sans-serif'}}>
              Redeem your Flux tokens for FXRP. The vault automatically pulls from the strategy if needed.
            </p>
            <button
              onClick={onNavigateToWithdraw}
              disabled={userShareBalance === 0}
              className="w-full py-3.5 rounded-full bg-white border border-[#1E1E1E]/15 text-[#171414] text-[11px] font-bold uppercase tracking-[0.15em] hover:border-[#E1BAC2] hover:text-[#E1BAC2] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4" />
              {userShareBalance > 0 ? 'Withdraw Now' : 'No Flux to Withdraw'}
            </button>
          </motion.div>
        </div>

        {/* ─── Yield Flow Diagram ─── */}
        <motion.div
          initial={{opacity: 0, y: 20}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.5, delay: 0.6}}
          className="glass-panel p-6 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial bg-white/60"
        >
          <h3 className="text-base font-bold text-[#1E1E1E] mb-4" style={{fontFamily: 'Manrope, sans-serif'}}>
            How Yield Generation Works
          </h3>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <FlowStep
              icon={<Wallet className="w-5 h-5" />}
              label="Deposit"
              sublabel="Send XRP"
              active={userShareBalance > 0}
            />
            <ArrowRight className="w-5 h-5 text-[#4A4A4A] rotate-90 sm:rotate-0" />
            <FlowStep
              icon={<Layers className="w-5 h-5" />}
              label="Mint Flux"
              sublabel="Receive tokens"
              active={userShareBalance > 0}
            />
            <ArrowRight className="w-5 h-5 text-[#4A4A4A] rotate-90 sm:rotate-0" />
            <FlowStep
              icon={<Cpu className="w-5 h-5" />}
              label="FCC Deploys"
              sublabel="Auto to strategy"
              active={hasActiveStrategy}
            />
            <ArrowRight className="w-5 h-5 text-[#4A4A4A] rotate-90 sm:rotate-0" />
            <FlowStep
              icon={<TrendingUp className="w-5 h-5" />}
              label="Earn Yield"
              sublabel="Auto-compound"
              active={hasActiveStrategy}
            />
          </div>
        </motion.div>

      </div>

      {/* ─── Strategies Modal ─── */}
      <StrategiesModal
        isOpen={showStrategiesModal}
        onClose={() => setShowStrategiesModal(false)}
        activeStrategy={activeStrategy as string}
      />
    </div>
  );
};

// ─── Stat Card Component ───
const StatCard: React.FC<{
  label: string;
  value: string;
  suffix: string;
  subtext: string;
  icon: React.ReactNode;
  delay: number;
}> = ({label, value, suffix, subtext, icon, delay}) => (
  <motion.div
    initial={{opacity: 0, y: 20}}
    animate={{opacity: 1, y: 0}}
    transition={{duration: 0.5, delay, ease: [0.16, 1, 0.3, 1]}}
    className="glass-panel stat-card-glow p-5 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial bg-white/60 hover:border-[#E1BAC2]/40 hover:shadow-[0_16px_40px_rgba(225,186,194,0.08)] transition-all duration-300"
  >
    <div className="flex items-center justify-between mb-3">
      <p className="text-[10px] font-mono font-bold text-[#4A4A4A] uppercase tracking-[0.15em]">{label}</p>
      <div className="stat-icon-ring" style={{width: 32, height: 32, borderRadius: 10}}>
        {icon}
      </div>
    </div>
    <p className="text-xl font-extrabold text-[#1E1E1E] leading-tight" style={{fontFamily: 'Manrope, sans-serif'}}>
      {value}
      {suffix && <span className="text-sm font-semibold text-[#4A4A4A] ml-1">{suffix}</span>}
    </p>
    <p className="text-xs text-[#4A4A4A] mt-1" style={{fontFamily: 'Hanken Grotesk, sans-serif'}}>{subtext}</p>
  </motion.div>
);

// ─── Flow Step Component ───
const FlowStep: React.FC<{
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  active: boolean;
}> = ({icon, label, sublabel, active}) => (
  <div className={`flex flex-col items-center gap-2 p-4 rounded-2xl ${
    active ? 'bg-emerald-50 border border-emerald-200' : 'bg-[#F5F5F3] border border-[#1E1E1E]/10'
  }`}>
    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
      active ? 'bg-emerald-500 text-white' : 'bg-[#1E1E1E]/10 text-[#4A4A4A]'
    }`}>
      {icon}
    </div>
    <div className="text-center">
      <p className={`text-xs font-bold ${active ? 'text-emerald-700' : 'text-[#1E1E1E]'}`}>{label}</p>
      <p className="text-[10px] text-[#4A4A4A]">{sublabel}</p>
    </div>
  </div>
);
