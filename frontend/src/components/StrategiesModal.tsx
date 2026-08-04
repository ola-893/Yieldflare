import React, { useRef, useState, useEffect } from 'react';
import { X, ExternalLink, Check, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import xrpImg from '../assets/images/xrp.webp';
import { CONTRACTS } from '../config/contracts';

interface Strategy {
  name: string;
  address: string;
  apyRange: string;
  riskLevel: string;
  description: string;
}

const STRATEGIES: Strategy[] = [
  {
    name: 'FTSO v2 Delegation',
    address: CONTRACTS.strategies.ftsoV2Delegation,
    apyRange: '3-8%',
    riskLevel: 'Low',
    description: 'Earn rewards by supporting Flare oracle network',
  },
  {
    name: 'SparkDEX LP',
    address: CONTRACTS.strategies.sparkDexLp,
    apyRange: '5-15%',
    riskLevel: 'Medium',
    description: 'Provide liquidity and earn trading fees',
  },
  {
    name: 'Smart Account Direct Mint',
    address: CONTRACTS.strategies.smartAccountDirectMint,
    apyRange: '2-5%',
    riskLevel: 'Low',
    description: 'Optimized FAsset minting with lower fees',
  },
  {
    name: 'Enosys DEX FXRP',
    address: CONTRACTS.strategies.enosysFxrp,
    apyRange: '8-14%',
    riskLevel: 'Medium',
    description: 'Cross-chain liquidity provision for higher yields',
  },
];

interface StrategiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeStrategy?: string;
}

export const StrategiesModal: React.FC<StrategiesModalProps> = ({
  isOpen,
  onClose,
  activeStrategy,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const checkScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setCanScrollDown(scrollTop + clientHeight < scrollHeight - 10);
    };
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    return () => el.removeEventListener('scroll', checkScroll);
  }, [isOpen]);

  // Stop wheel events from propagating to body when inside the modal
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[#1E1E1E]/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-[#F5F5F3] w-full max-w-2xl max-h-[85vh] sm:max-h-[80vh] rounded-none sm:rounded-3xl shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Fixed */}
            <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-[#1E1E1E]/10 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-[#171414]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Available Yield Strategies
                  </h2>
                  <p className="text-xs text-[#4A4A4A] mt-1">
                    Your Flux tokens earn yield from the active strategy
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-[#171414] flex items-center justify-center text-[#F5F5F3] hover:bg-[#E1BAC2] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div
              ref={scrollRef}
              onWheel={handleWheel}
              className="flex-1 overflow-y-auto p-4 sm:p-6 pt-3 sm:pt-4 pb-2 relative strategies-scroll overscroll-contain"
              style={{scrollbarWidth: 'thin', scrollbarColor: '#D1D5DB transparent'}}
            >
              {/* Info Banner */}
              <div className="mb-4 sm:mb-5 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <Zap className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-blue-800 mb-1">How Yield Works</p>
                    <p className="text-[11px] text-blue-700 leading-relaxed">
                      Your Flux tokens accrue value as the vault earns yield. The active strategy 
                      is automatically selected by the TEE based on the highest returns. All strategies 
                      are approved and deployed on Coston2 testnet.
                    </p>
                  </div>
                </div>
              </div>

              {/* Strategy Cards */}
              <div className="space-y-3">
                {STRATEGIES.map((strategy, idx) => {
                  const isActive = activeStrategy?.toLowerCase() === strategy.address.toLowerCase();
                  
                  return (
                    <motion.div
                      key={strategy.address}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.06 }}
                      className={`p-4 rounded-2xl border-2 transition-all ${
                        isActive
                          ? 'bg-emerald-50 border-emerald-300'
                          : 'bg-white border-[#1E1E1E]/10'
                      }`}
                    >
                      {/* Top row: icon, name, APY */}
                      <div className="flex items-start gap-3 mb-2">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-emerald-500' : 'bg-[#171414]'
                        }`}>
                          {isActive ? (
                            <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          ) : (
                            <img src={xrpImg} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-[13px] sm:text-sm font-bold text-[#171414] leading-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                              {strategy.name}
                            </h3>
                            <div className="text-right shrink-0">
                              <span className="text-base sm:text-xl font-extrabold text-[#171414]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                                {strategy.apyRange}
                              </span>
                              <p className="text-[8px] sm:text-[9px] text-[#4A4A4A]">APY</p>
                            </div>
                          </div>
                          <p className="text-[10px] text-[#4A4A4A] mt-0.5">
                            {strategy.description}
                          </p>
                        </div>
                      </div>

                      {/* Bottom row: status, contract, link */}
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isActive ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] sm:text-[10px] font-bold">
                              ✓ ACTIVE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-[#F5F5F3] text-[#4A4A4A] text-[9px] sm:text-[10px] font-bold border border-[#1E1E1E]/10">
                              DEPLOYED
                            </span>
                          )}
                          <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-[#F5F5F3] text-[#4A4A4A] text-[9px] font-mono">
                            {strategy.address.slice(0, 6)}...{strategy.address.slice(-4)}
                          </span>
                        </div>

                        <a
                          href={`https://coston2-explorer.flare.network/address/${strategy.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[9px] sm:text-[10px] text-[#4A4A4A] hover:text-[#E1BAC2] transition-colors shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Contract <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Bottom fade indicator when more content below */}
              {canScrollDown && (
                <div className="sticky bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#F5F5F3] to-transparent pointer-events-none" />
              )}
            </div>

            {/* Footer - Fixed */}
            <div className="p-3 sm:p-4 border-t border-[#1E1E1E]/10 bg-[#F5F5F3] shrink-0">
              <p className="text-[10px] text-[#4A4A4A] text-center">
                Yield is automatically compounded to your Flux token balance
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
