import React, {useState} from 'react';
import {useAccount, useBalance, useReadContract} from 'wagmi';
import {formatUnits} from 'viem';
import {motion} from 'motion/react';
import {TrendingUp, Layers, Clock, ArrowUpRight, ArrowDownRight, Wallet, RefreshCw, Zap, ShieldCheck, Copy, Check} from 'lucide-react';
import xrpImg from '../assets/images/xrp.webp';
import {CONTRACTS, PARENT_VAULT_ABI} from '../config/contracts';

const PARENT_VAULT_ADDRESS: `0x${string}` = CONTRACTS.parentVault;

interface DashboardProps {
  onNavigateToDeposit: () => void;
  onNavigateToWithdraw: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({onNavigateToDeposit, onNavigateToWithdraw}) => {
  const {address, isConnected} = useAccount();
  const {data: nativeBalance} = useBalance({address});
  const [copied, setCopied] = useState(false);

  // Check if contract address is deployed (not zero address)
  const isDeployed = PARENT_VAULT_ADDRESS !== '0x0000000000000000000000000000000000000000';

  // Read vault data (disabled when contract not deployed)
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

  // Calculate share price and user value (use formatUnits to avoid BigInt precision loss)
  const sharePrice = totalAssets && totalSupply && totalSupply > 0n
    ? Number(formatUnits(totalAssets, 18)) / Number(formatUnits(totalSupply, 18))
    : 1;
  const userShareBalance = userShares ? Number(formatUnits(userShares, 18)) : 0;
  const userValueUsd = userShareBalance * sharePrice;

  // Strategy name mapping
  const getStrategyName = (addr: string | undefined) => {
    if (!addr || addr === '0x0000000000000000000000000000000000000000') return 'No Active Strategy';
    return 'Kinetic Lending';
  };

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
            Connect to view your Flux portfolio and start earning yield on Flare Network
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
          className="mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-[#1E1E1E]/20 text-[10px] font-mono font-bold text-[#1E1E1E] uppercase tracking-[0.2em] mb-4 bg-white/40">
            <Zap className="w-3.5 h-3.5 text-[#E1BAC2]" />
            <span>PORTFOLIO</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1E1E1E] leading-tight" style={{fontFamily: 'Manrope, sans-serif'}}>
                Welcome back
              </h1>
              <button
                onClick={copyAddress}
                className="flex items-center gap-2 mt-2 group"
              >
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

            {/* Network badge */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 border border-[#1E1E1E]/10 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-[#4A4A4A]">
                Coston2 Testnet
              </span>
            </div>
          </div>

          {/* Decorative divider */}
          <div className="flux-divider mt-6">
            <div className="flux-divider-diamond" />
          </div>
        </motion.div>

        {/* ─── Stats Grid ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          <StatCard
            label="Your Vault Shares"
            value={userShareBalance > 0 ? `${userShareBalance.toFixed(4)}` : '0'}
            suffix="shares"
            subtext={userShareBalance > 0 ? `≈ $${userValueUsd.toFixed(2)}` : 'No deposits yet'}
            icon={<Layers className="w-5 h-5" />}
            delay={0.1}
          />
          <StatCard
            label="Share Price"
            value={`$${sharePrice.toFixed(6)}`}
            suffix=""
            subtext="Per ERC-4626 share"
            icon={<TrendingUp className="w-5 h-5" />}
            delay={0.2}
          />
          <StatCard
            label="Total Vault Assets"
            value={totalAssets ? `${formatUnits(totalAssets, 18).slice(0, 10)}` : '0'}
            suffix=""
            subtext="Underlying asset value"
            icon={<RefreshCw className="w-5 h-5" />}
            delay={0.3}
          />
          <StatCard
            label="Native Balance"
            value={nativeBalance ? `${parseFloat(nativeBalance.formatted).toFixed(4)}` : '—'}
            suffix={nativeBalance?.symbol || ''}
            subtext="Coston2 gas token"
            icon={<Wallet className="w-5 h-5" />}
            delay={0.4}
          />
        </div>

        {/* ─── Main Content Grid ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Active Strategy Card */}
          <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1]}}
            className="lg:col-span-2 glass-panel p-6 sm:p-8 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial bg-white/60"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#1E1E1E]/10">
              <div className="flex items-center gap-3">
                <div className="stat-icon-ring">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#1E1E1E]" style={{fontFamily: 'Manrope, sans-serif'}}>
                  Active Strategy
                </h3>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-mono font-bold border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </div>
            </div>

            {/* Strategy Info */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#171414] flex items-center justify-center shadow-[0_0_20px_rgba(225,186,194,0.15)]">
                <img src={xrpImg} alt="Strategy" className="w-9 h-9 object-contain" />
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-extrabold text-[#1E1E1E]" style={{fontFamily: 'Manrope, sans-serif'}}>
                  {getStrategyName(activeStrategy)}
                </h4>
                <p className="text-xs text-[#4A4A4A] font-mono mt-1">
                  {activeStrategy && activeStrategy !== '0x0000000000000000000000000000000000000000'
                    ? `${activeStrategy.slice(0, 6)}...${activeStrategy.slice(-4)}`
                    : 'No strategy deployed yet'}
                </p>
              </div>
            </div>

            {/* Protocol & Asset */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
                <p className="text-[10px] font-mono font-bold text-[#4A4A4A] uppercase tracking-wider mb-1">Protocol</p>
                <p className="text-sm font-bold text-[#1E1E1E]" style={{fontFamily: 'Manrope, sans-serif'}}>Kinetic Market</p>
              </div>
              <div className="p-4 rounded-2xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
                <p className="text-[10px] font-mono font-bold text-[#4A4A4A] uppercase tracking-wider mb-1">Asset</p>
                <p className="text-sm font-bold text-[#1E1E1E]" style={{fontFamily: 'Manrope, sans-serif'}}>USDC.e</p>
              </div>
            </div>

            {/* Strategy Details */}
            <div className="mt-5 p-4 rounded-2xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
              <p className="text-[10px] font-mono font-bold text-[#4A4A4A] uppercase tracking-wider mb-3">Security</p>
              <div className="flex items-start gap-2 text-xs text-[#1E1E1E]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E1BAC2] mt-1.5 shrink-0" />
                <span>Every rebalance is cryptographically signed by the FCC TEE enclave</span>
              </div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1]}}
            className="glass-panel p-6 sm:p-8 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial bg-white/60"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="stat-icon-ring">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-[#1E1E1E]" style={{fontFamily: 'Manrope, sans-serif'}}>
                Quick Actions
              </h3>
            </div>

            <div className="space-y-3">
              <button
                onClick={onNavigateToDeposit}
                className="w-full py-3.5 rounded-full bg-[#171414] text-[#E1BAC2] text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-[#000000] transition-all shadow-md hover:shadow-[0_4px_16px_rgba(225,186,194,0.25)] flex items-center justify-center gap-2 group"
                style={{fontFamily: 'Manrope, sans-serif'}}
              >
                <ArrowDownRight className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                <span>Deposit</span>
              </button>

              <button
                onClick={onNavigateToWithdraw}
                disabled={userShareBalance === 0}
                className="w-full py-3.5 rounded-full bg-white/75 border border-[#1E1E1E]/15 text-[#171414] text-[11px] font-bold uppercase tracking-[0.15em] hover:border-[#E1BAC2] hover:text-[#E1BAC2] hover:shadow-[0_4px_16px_rgba(225,186,194,0.15)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 backdrop-blur-sm group"
                style={{fontFamily: 'Manrope, sans-serif'}}
              >
                <ArrowUpRight className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                <span>Withdraw</span>
              </button>
            </div>

            {/* Settlement info */}
            <div className="mt-6">
              <div className="flux-divider">
                <div className="flux-divider-diamond" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-3.5 h-3.5 text-[#E1BAC2]" />
                <p className="text-[10px] font-mono font-bold text-[#4A4A4A] uppercase tracking-wider">Settlement</p>
              </div>
              <p className="text-xs text-[#4A4A4A] leading-relaxed" style={{fontFamily: 'Hanken Grotesk, sans-serif'}}>
                FAsset deposits are asynchronous. After sending native XRP/BTC, settlement may take minutes to hours depending on FAsset attestation.
              </p>
            </div>
          </motion.div>

        </div>

        {/* ─── Pending Deposits Section ─── */}
        <motion.div
          initial={{opacity: 0, y: 20}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.5, delay: 0.5, ease: [0.16, 1, 0.3, 1]}}
          className="mt-6 glass-panel p-6 sm:p-8 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial bg-white/60"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="stat-icon-ring">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[#1E1E1E]" style={{fontFamily: 'Manrope, sans-serif'}}>
              Pending Deposits
            </h3>
          </div>

          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-[#F5F5F3] border border-[#1E1E1E]/10 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-7 h-7 text-[#4A4A4A]/40" />
            </div>
            <p className="text-sm font-bold text-[#1E1E1E] mb-1" style={{fontFamily: 'Manrope, sans-serif'}}>No pending deposits</p>
            <p className="text-xs text-[#4A4A4A] max-w-sm mx-auto" style={{fontFamily: 'Hanken Grotesk, sans-serif'}}>
              Deposits in progress will appear here while awaiting FAsset settlement on Flare Network
            </p>
          </div>
        </motion.div>

      </div>
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
    className="glass-panel stat-card-glow p-5 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial bg-white/60 hover:border-[#E1BAC2]/40 hover:shadow-[0_16px_40px_rgba(225,186,194,0.08)] transition-all duration-300 group"
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
