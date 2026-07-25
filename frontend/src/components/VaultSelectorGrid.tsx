import React from 'react';
import { VaultInfo } from '../types';
import { ShieldCheck, Zap, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import xrpImg from '../assets/images/xrp.webp';
import btcImg from '../assets/images/btc.webp';

export const VAULTS_DATA: VaultInfo[] = [
  {
    id: 'kinetic-strategy',
    name: 'Kinetic Lending Strategy',
    assetSymbol: 'USDC.e',
    strategyType: 'Kinetic Lending' as const,
    projectedApy: '~6-10%',
    status: 'Testnet',
    primaryProtocol: 'Kinetic Market',
    primaryProtocolUrl: 'https://kinetic.market',
    description: 'Your funds earn interest by being lent out through Kinetic Market on Flare. Flux automatically moves your capital to capture the best available rates.',
    details: [
      'Earns lending interest automatically',
      'Bonus rewards harvested to the protocol',
      'Every capital move is cryptographically signed',
      'Running on Flare Coston2 testnet',
    ]
  },
  {
    id: 'enosys-strategy',
    name: 'Enosys DEX Strategy',
    assetSymbol: 'FXRP',
    strategyType: 'Enosys DEX LP' as const,
    projectedApy: '~8-14%',
    status: 'Testnet',
    primaryProtocol: 'Enosys DEX',
    primaryProtocolUrl: 'https://enosys.global',
    description: 'Your funds provide liquidity on Enosys DEX, earning fees from trades. Flux splits your deposit into a trading pair and holds both sides for yield.',
    details: [
      'Earns trading fees from DEX activity',
      'Automatic price protection on withdrawals',
      'Price data verified before any trade',
      'Running on Flare Coston2 testnet',
    ]
  }
];

interface VaultSelectorGridProps {
  onConnectWallet: () => void;
}

export const VaultSelectorGrid: React.FC<VaultSelectorGridProps> = ({ onConnectWallet }) => {
  return (
    <section id="vaults" className="py-24 bg-[#F5F5F3] border-t border-[#1E1E1E]/15 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-[#1E1E1E]/20 text-[10px] font-mono font-bold text-[#1E1E1E] uppercase tracking-[0.2em] mb-4 bg-white/40">
            <Zap className="w-3.5 h-3.5 text-[#E1BAC2]" />
            <span>STRATEGIES</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#1E1E1E] leading-tight mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Choose a strategy <br />
            <span className="font-semibold text-[#4A4A4A]">and start earning.</span>
          </h2>

          <p className="text-sm sm:text-base text-[#4A4A4A] leading-relaxed" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
            Each strategy is a non-custodial vault that puts your assets to work on Flare. You stay in control the whole time.
          </p>
        </motion.div>

        {/* Vault Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {VAULTS_DATA.map((vault, idx) => (
            <motion.div
              key={vault.id}
              onClick={onConnectWallet}
              className="glass-panel p-8 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial hover:border-[#E1BAC2] transition-all hover:scale-[1.02] cursor-pointer bg-white/60 group"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 * idx }}
            >
              {/* Vault Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#1E1E1E] text-[#F5F5F3] flex items-center justify-center group-hover:bg-[#E1BAC2] transition-colors overflow-hidden">
                    <img src={vault.assetSymbol === 'FXRP' ? xrpImg : btcImg} alt={vault.assetSymbol} className="w-8 h-8 object-contain" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#1E1E1E] group-hover:text-[#E1BAC2] transition-colors" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {vault.strategyType}
                    </h3>
                    <p className="text-[10px] font-mono text-[#4A4A4A] uppercase tracking-wider">
                      {vault.assetSymbol}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-mono font-bold border border-amber-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {vault.status}
                </div>
              </div>

              {/* Projected APY */}
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-[#1E1E1E]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {vault.projectedApy}
                  </span>
                  <span className="text-xs font-bold text-[#4A4A4A] bg-[#4A4A4A]/10 px-2 py-0.5 rounded-full">
                    EXAMPLE
                  </span>
                </div>
                <p className="text-xs text-[#4A4A4A] mt-1">Actual returns depend on market conditions</p>
              </div>

              {/* Protocol Link */}
              <div className="flex items-center gap-2 mb-6 p-3 rounded-2xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
                <ShieldCheck className="w-4 h-4 text-[#E1BAC2]" />
                <span className="text-xs font-mono text-[#1E1E1E] flex-1">Protocol: <strong>{vault.primaryProtocol}</strong></span>
                <ExternalLink className="w-3 h-3 text-[#4A4A4A]" />
              </div>

              {/* Description */}
              <p className="text-xs text-[#4A4A4A] leading-relaxed mb-6" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
                {vault.description}
              </p>

              {/* Strategy Details */}
              <div className="space-y-2">
                <p className="text-[10px] font-mono font-bold text-[#4A4A4A] uppercase tracking-wider">What you get</p>
                {vault.details.map((detail, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-[#1E1E1E]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E1BAC2] mt-1.5 shrink-0" />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button className="w-full py-3 rounded-xl bg-[#1E1E1E] text-[#E1BAC2] text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-[#000000] transition-all shadow-sm flex items-center justify-center gap-2 mt-6">
                <span>Explore Strategy</span>
              </button>

            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};
