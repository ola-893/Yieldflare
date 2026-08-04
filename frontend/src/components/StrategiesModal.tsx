import React from 'react';
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
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[#1E1E1E]/60 backdrop-blur-md flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-[#F5F5F3] w-full max-w-2xl max-h-[80vh] rounded-3xl shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Fixed */}
            <div className="p-6 pb-4 border-b border-[#1E1E1E]/10">
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
            <div className="flex-1 overflow-y-auto p-6 pt-4 scrollbar-hide">
              {/* Info Banner */}
              <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                <div className="flex items-start gap-3">
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
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isActive ? 'bg-emerald-500' : 'bg-[#171414]'
                          }`}>
                            {isActive ? (
                              <Check className="w-5 h-5 text-white" />
                            ) : (
                              <img src={xrpImg} alt="" className="w-6 h-6 object-contain" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[#171414]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                              {strategy.name}
                            </h3>
                            <p className="text-[10px] text-[#4A4A4A]">
                              {strategy.description}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-extrabold text-[#171414]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            {strategy.apyRange}
                          </span>
                          <p className="text-[9px] text-[#4A4A4A]">APY</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isActive ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                              ✓ ACTIVE
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-[#F5F5F3] text-[#4A4A4A] text-[10px] font-bold border border-[#1E1E1E]/10">
                              DEPLOYED
                            </span>
                          )}
                          <span className="px-2 py-1 rounded-full bg-[#F5F5F3] text-[#4A4A4A] text-[9px] font-mono">
                            {strategy.address.slice(0, 6)}...{strategy.address.slice(-4)}
                          </span>
                        </div>

                        <a
                          href={`https://coston2-explorer.flare.network/address/${strategy.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-[#4A4A4A] hover:text-[#E1BAC2] transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Contract <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Footer - Fixed */}
            <div className="p-4 border-t border-[#1E1E1E]/10 bg-[#F5F5F3]">
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
