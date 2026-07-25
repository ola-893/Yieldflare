import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Calculator, Info } from 'lucide-react';
import { motion } from 'motion/react';
import xrpImg from '../assets/images/xrp.webp';
import btcImg from '../assets/images/btc.webp';

interface VaultSimulatorProps {
  onConnectWallet: () => void;
}

export const VaultSimulator: React.FC<VaultSimulatorProps> = ({ onConnectWallet }) => {
  const [asset, setAsset] = useState<'XRP' | 'BTC'>('XRP');
  const [depositAmount, setDepositAmount] = useState<number>(asset === 'XRP' ? 10000 : 1);
  const [durationMonths, setDurationMonths] = useState<number>(12);

  const assetPrice = asset === 'XRP' ? 2.40 : 96000;
  const apyRate = asset === 'XRP' ? 0.10 : 0.08;

  const chartData = useMemo(() => {
    const data = [];
    const monthlyRate = apyRate / 12;
    let currentPrincipal = depositAmount * assetPrice;

    for (let month = 0; month <= durationMonths; month++) {
      const compoundedUsd = currentPrincipal * Math.pow(1 + monthlyRate, month);
      const nativeAmount = compoundedUsd / assetPrice;
      const profitUsd = compoundedUsd - (depositAmount * assetPrice);

      data.push({
        month: `M${month}`,
        label: `Month ${month}`,
        compoundedUsd: Math.round(compoundedUsd),
        nativeAmount: Number(nativeAmount.toFixed(asset === 'XRP' ? 1 : 4)),
        profitUsd: Math.round(profitUsd)
      });
    }
    return data;
  }, [asset, depositAmount, durationMonths, apyRate, assetPrice]);

  const finalData = chartData[chartData.length - 1];

  return (
    <section id="simulator" className="py-24 bg-[#F5F5F3] border-t border-[#1E1E1E]/15 relative">
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
            <Calculator className="w-3.5 h-3.5 text-[#E1BAC2]" />
            <span>YIELD CALCULATOR</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#1E1E1E] leading-tight mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
            See what your deposit <br />
            <span className="font-semibold text-[#4A4A4A]">could earn over time.</span>
          </h2>

          <p className="text-sm sm:text-base text-[#4A4A4A] leading-relaxed" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
            Adjust the sliders to explore potential returns. These are illustrative examples — actual results depend on market conditions and strategy performance.
          </p>
        </motion.div>

        {/* Simulator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Controls */}
          <motion.div
            className="lg:col-span-5 glass-panel p-6 sm:p-8 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial bg-white/60"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          >
            {/* Asset Selector */}
            <div className="mb-6">
              <label className="block text-[10px] font-mono font-bold text-[#1E1E1E] uppercase tracking-[0.2em] mb-2">
                Choose your asset
              </label>
              <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl border border-[#1E1E1E]/15 bg-[#F5F5F3]">
                <button
                  onClick={() => { setAsset('XRP'); setDepositAmount(10000); }}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    asset === 'XRP'
                      ? 'bg-[#1E1E1E] text-[#E1BAC2] shadow-sm'
                      : 'text-[#4A4A4A] hover:text-[#1E1E1E]'
                  }`}
                >
                  <img src={xrpImg} alt="" className="w-4 h-4 object-contain" />
                  XRP
                </button>

                <button
                  onClick={() => { setAsset('BTC'); setDepositAmount(1); }}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    asset === 'BTC'
                      ? 'bg-[#1E1E1E] text-[#E1BAC2] shadow-sm'
                      : 'text-[#4A4A4A] hover:text-[#1E1E1E]'
                  }`}
                >
                  <img src={btcImg} alt="" className="w-4 h-4 object-contain" />
                  BTC
                </button>
              </div>
            </div>

            {/* Deposit Amount */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-mono font-bold text-[#1E1E1E] uppercase tracking-[0.2em]">
                  How much to deposit
                </label>
                <span className="text-sm font-mono font-bold text-[#E1BAC2]">
                  {depositAmount.toLocaleString()} {asset} (${(depositAmount * assetPrice).toLocaleString()})
                </span>
              </div>
              <input
                type="range"
                min={asset === 'XRP' ? 1000 : 0.1}
                max={asset === 'XRP' ? 100000 : 10}
                step={asset === 'XRP' ? 1000 : 0.1}
                value={depositAmount}
                onChange={(e) => setDepositAmount(parseFloat(e.target.value))}
                className="w-full accent-[#1E1E1E] bg-[#1E1E1E]/20 h-2 rounded-lg cursor-pointer"
              />
              <div className="flex items-center justify-between text-[10px] font-mono text-[#4A4A4A] mt-1">
                <span>{asset === 'XRP' ? '1,000 XRP' : '0.1 BTC'}</span>
                <span>{asset === 'XRP' ? '100,000 XRP' : '10 BTC'}</span>
              </div>
            </div>

            {/* Duration */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-mono font-bold text-[#1E1E1E] uppercase tracking-[0.2em]">
                  How long to hold
                </label>
                <span className="text-sm font-mono font-bold text-[#1E1E1E]">
                  {durationMonths} Months
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={24}
                step={1}
                value={durationMonths}
                onChange={(e) => setDurationMonths(parseInt(e.target.value))}
                className="w-full accent-[#1E1E1E] bg-[#1E1E1E]/20 h-2 rounded-lg cursor-pointer"
              />
              <div className="flex items-center justify-between text-[10px] font-mono text-[#4A4A4A] mt-1">
                <span>1 Month</span>
                <span>12 Months</span>
                <span>24 Months</span>
              </div>
            </div>

            {/* Projected Summary */}
            <div className="p-5 rounded-2xl bg-[#1E1E1E] text-[#F5F5F3] mb-6 shadow-sm">
              <div className="text-[10px] font-mono font-bold text-[#E1BAC2] uppercase tracking-wider mb-1">
                Example yield earned
              </div>
              <div className="text-2xl font-extrabold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                +${finalData.profitUsd.toLocaleString()} USD
              </div>
              <div className="text-xs text-white/80 mt-1">
                Ending balance: <span className="font-bold text-[#E1BAC2]">{finalData.nativeAmount} {asset}</span> (${finalData.compoundedUsd.toLocaleString()})
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={onConnectWallet}
              className="w-full py-3.5 rounded-full bg-[#1E1E1E] text-[#E1BAC2] text-[11px] font-semibold uppercase tracking-[0.2em] hover:bg-[#000000] transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>Start Depositing</span>
            </button>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-[#4A4A4A]">
              <Info className="w-3 h-3" />
              <span>Illustrative only. Not financial advice.</span>
            </div>

          </motion.div>

          {/* Right Chart */}
          <motion.div
            className="lg:col-span-7 glass-panel p-6 sm:p-8 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial flex flex-col justify-between min-h-[440px] bg-white/60"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#1E1E1E]/10">
                <div>
                  <h3 className="text-base font-bold text-[#1E1E1E]" style={{ fontFamily: 'Manrope, sans-serif' }}>Projected Growth</h3>
                  <p className="text-xs text-[#4A4A4A]">Example at {(apyRate * 100).toFixed(0)}% APY (illustrative)</p>
                </div>
                <div className="px-3 py-1 rounded-full border border-[#E1BAC2]/30 bg-[#E1BAC2]/10 text-[#E1BAC2] text-xs font-mono font-bold">
                  ~{(apyRate * 100).toFixed(0)}% Example
                </div>
              </div>

              <div className="w-full h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pinkArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E1BAC2" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#E1BAC2" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" stroke="#1E1E1E" strokeOpacity={0.4} fontSize={11} tickLine={false} />
                    <YAxis stroke="#1E1E1E" strokeOpacity={0.4} fontSize={11} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FAFAF8', borderColor: '#1E1E1E', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(value: any) => [`$${Number(value).toLocaleString()} USD`, 'Balance']}
                    />
                    <Area type="monotone" dataKey="compoundedUsd" stroke="#1E1E1E" strokeWidth={2.5} fillOpacity={1} fill="url(#pinkArea)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Footer metrics */}
            <div className="grid grid-cols-3 gap-3 pt-6 border-t border-[#1E1E1E]/10 text-center">
              <div>
                <span className="block text-[10px] font-mono text-[#4A4A4A] uppercase font-bold">You deposit</span>
                <span className="text-xs font-bold text-[#1E1E1E]">${(depositAmount * assetPrice).toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-[#4A4A4A] uppercase font-bold">Example APY</span>
                <span className="text-xs font-bold text-[#E1BAC2]">{(apyRate * 100).toFixed(0)}%</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-[#4A4A4A] uppercase font-bold">You could earn</span>
                <span className="text-xs font-bold text-emerald-600">+{((finalData.profitUsd / (depositAmount * assetPrice)) * 100).toFixed(1)}%*</span>
              </div>
            </div>

          </motion.div>

        </div>

      </div>
    </section>
  );
};
