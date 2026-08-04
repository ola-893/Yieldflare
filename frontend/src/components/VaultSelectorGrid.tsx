import React from 'react';
import { VaultInfo } from '../types';
import { ShieldCheck, Zap, ExternalLink, Check } from 'lucide-react';
import { motion } from 'motion/react';
import xrpImg from '../assets/images/xrp.webp';
import { CONTRACTS } from '../config/contracts';

export const VAULTS_DATA: VaultInfo[] = [
  {
    id: 'ftso-strategy',
    name: 'FTSO v2 Delegation',
    assetSymbol: 'FXRP',
    strategyType: 'FTSO Delegation' as const,
    projectedApy: '~3-8%',
    status: 'Deployed',
    primaryProtocol: 'Flare FTSO',
    primaryProtocolUrl: 'https://flare.network',
    contractAddress: CONTRACTS.strategies.ftsoV2Delegation,
    description: 'Delegate your FXRP to Flare Time Series Oracle (FTSO) data providers. Earn rewards by supporting decentralized price feeds on Flare Network.',
    details: [
      'Earn FTSO delegation rewards',
      'Supports Flare oracle network',
      'Low risk — native protocol participation',
      'Auto-compounds rewards to vault',
    ]
  },
  {
    id: 'sparkdex-strategy',
    name: 'SparkDEX LP',
    assetSymbol: 'FXRP',
    strategyType: 'SparkDEX LP' as const,
    projectedApy: '~5-15%',
    status: 'Deployed',
    primaryProtocol: 'SparkDEX',
    primaryProtocolUrl: 'https://sparkdex.io',
    contractAddress: CONTRACTS.strategies.sparkDexLp,
    description: 'Provide liquidity on SparkDEX, Flare\'s native DEX. Earn trading fees from swaps between FXRP and other Flare assets.',
    details: [
      'Earn trading fees from DEX activity',
      'Impermanent loss protection',
      'Automatic rebalancing',
      'Running on Flare Coston2 testnet',
    ]
  },
  {
    id: 'smart-account-strategy',
    name: 'Smart Account Direct Mint',
    assetSymbol: 'FXRP',
    strategyType: 'Direct Mint' as const,
    projectedApy: '~2-5%',
    status: 'Deployed',
    primaryProtocol: 'FAsset System',
    primaryProtocolUrl: 'https://flare.network',
    contractAddress: CONTRACTS.strategies.smartAccountDirectMint,
    description: 'Optimized direct minting path for FAssets. Reduces fees and speeds up the deposit-to-yield flow for FXRP.',
    details: [
      'Lower minting fees',
      'Faster deposit settlement',
      'Optimized for large deposits',
      'Direct FAsset integration',
    ]
  },
  {
    id: 'enosys-strategy',
    name: 'Enosys DEX FXRP',
    assetSymbol: 'FXRP',
    strategyType: 'Enosys DEX LP' as const,
    projectedApy: '~8-14%',
    status: 'Deployed',
    primaryProtocol: 'Enosys DEX',
    primaryProtocolUrl: 'https://enosys.global',
    contractAddress: CONTRACTS.strategies.enosysFxrp,
    description: 'Provide liquidity on Enosys DEX, earning fees from FXRP trading pairs. Higher yields from cross-chain trading activity.',
    details: [
      'Earn trading fees from DEX activity',
      'Cross-chain liquidity provision',
      'Higher APY potential',
      'Price data verified before trades',
    ]
  },
  {
    id: 'enosys-cdp-strategy',
    name: 'Enosys CDP LP',
    assetSymbol: 'CDP',
    strategyType: 'Enosys CDP LP' as const,
    projectedApy: '~8-20%',
    status: 'Deployed',
    primaryProtocol: 'Enosys DEX',
    primaryProtocolUrl: 'https://enosys.global',
    contractAddress: CONTRACTS.strategies.enosysCdpLp,
    description: 'Provide concentrated liquidity on Enosys DEX for the CDP/WC2FLR pair. Earn trading fees from stablecoin swaps with lower volatility.',
    details: [
      'Stablecoin LP — lower impermanent loss',
      'Earn 0.30% swap fees on CDP/WC2FLR',
      'Concentrated liquidity for higher capital efficiency',
      'Stable yield for risk-averse users',
    ]
  },
];

interface VaultSelectorGridProps {
  onConnectWallet?: () => void;
}

export const VaultSelectorGrid: React.FC<VaultSelectorGridProps> = ({ onConnectWallet }) => {
  return (
    <section id="vaults" className="py-12 bg-[#F5F5F3] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Status Banner */}
        <motion.div
          className="mb-8 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
              5 Strategies Deployed & Ready
            </p>
            <p className="text-xs text-emerald-700">
              All yield strategies are deployed on Coston2 testnet. Capital deployment pending TEE activation.
            </p>
          </div>
        </motion.div>

        {/* Vault Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {VAULTS_DATA.map((vault, idx) => (
            <motion.div
              key={vault.id}
              onClick={onConnectWallet}
              className="glass-panel p-6 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial hover:border-[#E1BAC2] transition-all hover:scale-[1.01] bg-white/60 group"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 * idx }}
            >
              {/* Vault Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1E1E1E] text-[#F5F5F3] flex items-center justify-center group-hover:bg-[#E1BAC2] transition-colors overflow-hidden">
                    <img src={xrpImg} alt={vault.assetSymbol} className="w-6 h-6 object-contain" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1E1E1E] group-hover:text-[#E1BAC2] transition-colors" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {vault.strategyType}
                    </h3>
                    <p className="text-[10px] font-mono text-[#4A4A4A] uppercase tracking-wider">
                      {vault.assetSymbol}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-mono font-bold border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {vault.status}
                </div>
              </div>

              {/* Projected APY */}
              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-[#1E1E1E]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {vault.projectedApy}
                  </span>
                  <span className="text-[10px] font-bold text-[#4A4A4A] bg-[#4A4A4A]/10 px-2 py-0.5 rounded-full">
                    PROJECTED
                  </span>
                </div>
                <p className="text-[10px] text-[#4A4A4A] mt-1">Actual returns depend on market conditions</p>
              </div>

              {/* Protocol Link */}
              <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
                <ShieldCheck className="w-4 h-4 text-[#E1BAC2]" />
                <span className="text-[11px] font-mono text-[#1E1E1E] flex-1">Protocol: <strong>{vault.primaryProtocol}</strong></span>
                <ExternalLink className="w-3 h-3 text-[#4A4A4A]" />
              </div>

              {/* Description */}
              <p className="text-[11px] text-[#4A4A4A] leading-relaxed mb-4" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
                {vault.description}
              </p>

              {/* Strategy Details */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-mono font-bold text-[#4A4A4A] uppercase tracking-wider">What you get</p>
                {vault.details.map((detail, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-[#1E1E1E]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E1BAC2] mt-1.5 shrink-0" />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>

              {/* Contract Address */}
              {vault.contractAddress && (
                <div className="mt-4 pt-3 border-t border-[#1E1E1E]/10">
                  <p className="text-[9px] font-mono text-[#4A4A4A] truncate">
                    Contract: {vault.contractAddress.slice(0, 6)}...{vault.contractAddress.slice(-4)}
                  </p>
                </div>
              )}

            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};
