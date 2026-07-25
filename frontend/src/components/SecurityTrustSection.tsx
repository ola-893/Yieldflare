import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Cpu, KeyRound, Terminal } from 'lucide-react';

export const SecurityTrustSection: React.FC = () => {
  return (
    <section id="tee-security" className="py-24 bg-[#F5F5F3] border-t border-[#1E1E1E]/15 relative">
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
            <Cpu className="w-3.5 h-3.5 text-[#E1BAC2]" />
            <span>SECURITY</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#1E1E1E] leading-tight mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Your funds, <br />
            <span className="font-semibold text-[#4A4A4A]">your rules.</span>
          </h2>

          <p className="text-sm sm:text-base text-[#4A4A4A] leading-relaxed" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
            Flux is built so no one — not even the team behind it — can access your money without your permission. Every move is signed, verified, and protected.
          </p>
        </motion.div>

        {/* Security Cards + Contract Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Security Features (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            <motion.div
              className="glass-panel p-6 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial flex items-start gap-4 bg-white/60"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            >
              <div className="w-10 h-10 rounded-full bg-[#1E1E1E] text-[#F5F5F3] flex items-center justify-center shrink-0">
                <Cpu className="w-5 h-5 text-[#E1BAC2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1E1E1E] mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>Every move is signed</h3>
                <p className="text-xs text-[#4A4A4A] leading-relaxed">
                  When Flux moves your funds between strategies, it requires a cryptographic signature from an authorized signer. No one can move your money without proper approval.
                </p>
              </div>
            </motion.div>

            <motion.div
              className="glass-panel p-6 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial flex items-start gap-4 bg-white/60"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            >
              <div className="w-10 h-10 rounded-full bg-[#1E1E1E] text-[#F5F5F3] flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5 text-[#E1BAC2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1E1E1E] mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>You hold the keys</h3>
                <p className="text-xs text-[#4A4A4A] leading-relaxed">
                  Your deposits are tracked as vault share tokens in your wallet. Only you can withdraw your funds by burning those shares — no one else can touch them.
                </p>
              </div>
            </motion.div>

            <motion.div
              className="glass-panel p-6 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial flex items-start gap-4 bg-white/60"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            >
              <div className="w-10 h-10 rounded-full bg-[#1E1E1E] text-[#F5F5F3] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#E1BAC2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1E1E1E] mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>Built-in safety checks</h3>
                <p className="text-xs text-[#4A4A4A] leading-relaxed">
                  Every rebalance checks minimum amounts and validates price data to protect against bad trades or market manipulation. If something looks off, the move is rejected.
                </p>
              </div>
            </motion.div>

          </div>

          {/* Contract Info Panel (5 cols) */}
          <motion.div
            className="lg:col-span-5 bg-[#1E1E1E] text-[#F5F5F3] p-6 sm:p-8 rounded-3xl border border-[#1E1E1E] shadow-2xl flex flex-col justify-between"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#E1BAC2]" />
                  <span className="text-[10px] font-mono font-bold text-white uppercase tracking-[0.2em]">Contract Info</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>LIVE</span>
                </div>
              </div>

              <div className="space-y-3 font-mono text-xs text-white/90 mb-6 bg-black/50 p-4 rounded-2xl border border-white/10">
                <div>
                  <span className="text-[#E1BAC2]">Network:</span>
                  <div className="text-[11px] text-white/90">Flare Coston2 Testnet</div>
                </div>

                <div>
                  <span className="text-[#E1BAC2]">Vault Standard:</span>
                  <div className="text-[11px] text-white/90">ERC-4626 Non-Custodial</div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/10">
                  <span className="text-white/85">Signature Type:</span>
                  <span className="font-semibold text-white">EIP-712 ECDSA</span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/85">Contract:</span>
                  <span className="text-emerald-400 font-bold">UUPS Upgradeable</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
              <p className="text-[11px] text-white/80 leading-relaxed">
                Flux contracts are upgradeable through a transparent UUPS proxy pattern — meaning improvements can be made while keeping your funds safe.
              </p>
            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
};
