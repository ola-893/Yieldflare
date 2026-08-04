import React, {useState, useEffect} from 'react';
import {useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance} from 'wagmi';
import {formatUnits, parseUnits} from 'viem';
import {motion, AnimatePresence} from 'motion/react';
import {ArrowUpRight, RefreshCw, Check, AlertCircle, Wallet, Layers, TrendingUp, Clock, ArrowRight, Zap, Coins, Construction} from 'lucide-react';
import {CONTRACTS, PARENT_VAULT_ABI} from '../config/contracts';
import xrpImg from '../assets/images/xrp.webp';
import btcImg from '../assets/images/btc.webp';

// Write-only ABI (non-const to satisfy wagmi writeContract typing)
const WITHDRAW_ABI = [
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {name: 'assets', type: 'uint256'},
      {name: 'receiver', type: 'address'},
      {name: 'owner', type: 'address'},
    ],
    outputs: [{name: 'shares', type: 'uint256'}],
  },
];

const PARENT_VAULT_ADDRESS: `0x${string}` = CONTRACTS.parentVault;

type WithdrawPhase = 'FLUX' | 'C2FLR';
type WithdrawStep = 'INPUT' | 'CONFIRMING' | 'SUCCESS' | 'ERROR';

interface WithdrawPageProps {
  onBack: () => void;
}

export const WithdrawPage: React.FC<WithdrawPageProps> = ({onBack}) => {
  const {address, isConnected} = useAccount();
  const [phase, setPhase] = useState<WithdrawPhase>('FLUX');
  const [step, setStep] = useState<WithdrawStep>('INPUT');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const isDeployed = PARENT_VAULT_ADDRESS !== '0x0000000000000000000000000000000000000000';

  // ─── Contract Reads ───
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

  const {data: maxWithdrawAmount} = useReadContract({
    address: PARENT_VAULT_ADDRESS,
    abi: PARENT_VAULT_ABI,
    functionName: 'maxWithdraw',
    args: address ? [address] : undefined,
    query: {enabled: isDeployed && !!address},
  });

  // Read actual vault decimals (6 for FXRP, not hardcoded 18)
  const {data: vaultDecimals} = useReadContract({
    address: PARENT_VAULT_ADDRESS,
    abi: PARENT_VAULT_ABI,
    functionName: 'decimals',
    query: {enabled: isDeployed},
  });
  const decimals = vaultDecimals ?? 18;

  // Read C2FLR balance for Phase 2
  const {data: nativeBalance} = useBalance({address});

  // Preview conversions
  const parsedAmount = amount && !isNaN(parseFloat(amount)) ? parseUnits(amount, decimals) : 0n;

  const {data: previewShares} = useReadContract({
    address: PARENT_VAULT_ADDRESS,
    abi: PARENT_VAULT_ABI,
    functionName: 'previewWithdraw',
    args: parsedAmount > 0n ? [parsedAmount] : undefined,
    query: {enabled: isDeployed && parsedAmount > 0n && phase === 'FLUX'},
  });

  // ─── Contract Writes ───
  const {writeContract, data: writeHash, isPending: isWritePending, error: writeError} = useWriteContract();
  const {isLoading: isConfirming, isSuccess: isConfirmed} = useWaitForTransactionReceipt({hash: writeHash});

  useEffect(() => {
    if (isConfirmed) {
      setStep('SUCCESS');
      setTxHash(writeHash || null);
    }
  }, [isConfirmed, writeHash]);

  // Handle transaction rejection/failure
  useEffect(() => {
    if (step !== 'CONFIRMING') return;
    if (writeError) {
      setStep('INPUT');
      setError(`Transaction failed: ${writeError.message?.slice(0, 100) || 'Unknown error'}`);
    } else if (!isWritePending && !isConfirming && !isConfirmed && !writeHash) {
      setStep('INPUT');
      setError('Transaction was rejected. Please try again.');
    }
  }, [step, isWritePending, isConfirming, isConfirmed, writeHash, writeError]);

  // Timeout safety net
  useEffect(() => {
    if (step !== 'CONFIRMING') return;
    const timeout = setTimeout(() => {
      setStep('INPUT');
      setError('Transaction timed out. It may have reverted — please check the explorer and try again.');
    }, 60000);
    return () => clearTimeout(timeout);
  }, [step]);

  // ─── Computed Values ───
  const sharePrice = totalAssets && totalSupply && totalSupply > 0n
    ? Number(formatUnits(totalAssets, decimals)) / Number(formatUnits(totalSupply, decimals))
    : 1;

  const userShareBalance = userShares ? Number(formatUnits(userShares, decimals)) : 0;
  const userAssetValue = userShareBalance * sharePrice;

  const maxWithdrawFormatted = maxWithdrawAmount ? Number(formatUnits(maxWithdrawAmount, decimals)) : 0;

  const previewSharesFormatted = previewShares ? Number(formatUnits(previewShares, decimals)) : 0;

  const c2flrBalance = nativeBalance ? parseFloat(nativeBalance.formatted) : 0;

  // ─── Validation ───
  const validateAmount = (): string | null => {
    if (!amount || parseFloat(amount) <= 0) return 'Enter an amount';
    const parsed = parseFloat(amount);

    if (phase === 'FLUX') {
      if (parsed > maxWithdrawFormatted) return `Maximum withdrawable: ${maxWithdrawFormatted.toFixed(6)} FXRP`;
    } else {
      // C2FLR phase - no contract call needed, just validate
      if (parsed > c2flrBalance) return `Insufficient C2FLR balance`;
    }
    return null;
  };

  // ─── Handlers ───
  const handleWithdraw = () => {
    const validationError = validateAmount();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    if (phase === 'FLUX') {
      writeContract({
        address: PARENT_VAULT_ADDRESS,
        abi: WITHDRAW_ABI,
        functionName: 'withdraw',
        args: [parsedAmount, address!, address!],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    } else {
      // C2FLR withdrawal - this would be a simple native transfer
      // For now, show a message that C2FLR withdrawal is handled via faucet
      setError('C2FLR can be obtained from the Flare faucet. Native token withdrawals are not currently supported through this interface.');
      return;
    }
    setStep('CONFIRMING');
  };

  const handleMax = () => {
    if (phase === 'FLUX') {
      setAmount(maxWithdrawFormatted > 0 ? maxWithdrawFormatted.toFixed(6) : '0');
    } else {
      setAmount(c2flrBalance > 0 ? c2flrBalance.toFixed(6) : '0');
    }
    setError(null);
  };

  const handleReset = () => {
    setStep('INPUT');
    setAmount('');
    setError(null);
    setTxHash(null);
  };

  // ─── Not Connected State ───
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#F5F5F3] flex items-center justify-center pt-24">
        <motion.div
          className="text-center"
          initial={{opacity: 0, y: 30}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.6, ease: [0.16, 1, 0.3, 1]}}
        >
          <div className="stat-icon-ring mx-auto mb-6" style={{width: 64, height: 64, borderRadius: 20}}>
            <Wallet className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-extrabold text-[#171414] mb-3" style={{fontFamily: 'Manrope, sans-serif'}}>
            Connect your wallet
          </h2>
          <p className="text-sm text-[#4A4A4A] max-w-sm mx-auto mb-6" style={{fontFamily: 'Hanken Grotesk, sans-serif'}}>
            Connect to withdraw your assets from Flux Protocol
          </p>
          <button onClick={onBack} className="text-xs font-bold text-[#E1BAC2] hover:underline">
            ← Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F3] pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">

        {/* Back button */}
        <button onClick={onBack} className="flex items-center gap-2 text-xs font-bold text-[#4A4A4A] hover:text-[#171414] transition-colors mb-8 font-['Manrope',sans-serif]">
          ← Back to Dashboard
        </button>

        {/* Header */}
        <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-[rgba(23,20,20,0.1)] text-[10px] font-bold text-[#171414] uppercase tracking-[0.2em] mb-4 bg-white/40 font-['Manrope',sans-serif]">
            <ArrowUpRight className="w-3.5 h-3.5 text-[#E1BAC2]" />
            <span>WITHDRAW</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#171414]" style={{fontFamily: 'Manrope, sans-serif'}}>
            Withdraw Assets
          </h1>
          <p className="text-sm text-[#4A4A4A] mt-2 font-['Hanken_Grotesk',sans-serif]">
            Choose what you want to withdraw
          </p>
        </motion.div>

        {/* Phase Selector */}
        <motion.div 
          initial={{opacity: 0, y: 20}} 
          animate={{opacity: 1, y: 0}} 
          transition={{delay: 0.1}}
          className="grid grid-cols-2 gap-4 mb-8"
        >
          <button
            onClick={() => {setPhase('FLUX'); setAmount(''); setError(null);}}
            className={`p-5 rounded-3xl border-2 transition-all text-left ${
              phase === 'FLUX'
                ? 'border-[#171414] bg-white shadow-lg'
                : 'border-[rgba(23,20,20,0.08)] bg-white/40 hover:border-[rgba(23,20,20,0.15)]'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                phase === 'FLUX' ? 'bg-[#171414]' : 'bg-[#F5F5F3]'
              }`}>
                <Coins className={`w-5 h-5 ${phase === 'FLUX' ? 'text-[#E1BAC2]' : 'text-[#4A4A4A]'}`} />
              </div>
              <div>
                <p className={`text-sm font-bold font-['Manrope',sans-serif] ${phase === 'FLUX' ? 'text-[#171414]' : 'text-[#4A4A4A]'}`}>
                  Flux Tokens
                </p>
                <p className="text-[10px] text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">
                  Withdraw to XRP
                </p>
              </div>
            </div>
            <div className={`p-3 rounded-xl ${phase === 'FLUX' ? 'bg-[#F5F5F3]' : 'bg-white/60'}`}>
              <div className="flex items-center gap-2">
                <img src={xrpImg} alt="XRP" className="w-5 h-5 object-contain" />
                <span className="text-[11px] font-bold text-[#171414]">XRP</span>
                <span className="text-[10px] text-emerald-600 font-bold ml-auto">Available</span>
              </div>
              <div className="flex items-center gap-2 mt-2 opacity-50">
                <img src={btcImg} alt="BTC" className="w-5 h-5 object-contain grayscale" />
                <span className="text-[11px] font-bold text-[#4A4A4A]">BTC</span>
                <span className="text-[10px] text-[#4A4A4A] font-bold ml-auto flex items-center gap-1">
                  <Construction className="w-3 h-3" />
                  Coming Soon
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={() => {setPhase('C2FLR'); setAmount(''); setError(null);}}
            className={`p-5 rounded-3xl border-2 transition-all text-left ${
              phase === 'C2FLR'
                ? 'border-[#171414] bg-white shadow-lg'
                : 'border-[rgba(23,20,20,0.08)] bg-white/40 hover:border-[rgba(23,20,20,0.15)]'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                phase === 'C2FLR' ? 'bg-[#171414]' : 'bg-[#F5F5F3]'
              }`}>
                <Zap className={`w-5 h-5 ${phase === 'C2FLR' ? 'text-[#E1BAC2]' : 'text-[#4A4A4A]'}`} />
              </div>
              <div>
                <p className={`text-sm font-bold font-['Manrope',sans-serif] ${phase === 'C2FLR' ? 'text-[#171414]' : 'text-[#4A4A4A]'}`}>
                  C2FLR Gas
                </p>
                <p className="text-[10px] text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">
                  For transaction fees
                </p>
              </div>
            </div>
            <div className={`p-3 rounded-xl ${phase === 'C2FLR' ? 'bg-[#F5F5F3]' : 'bg-white/60'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#4A4A4A]">Your Balance</span>
                <span className="text-[11px] font-bold text-[#171414] font-mono">
                  {c2flrBalance.toFixed(4)} C2FLR
                </span>
              </div>
            </div>
          </button>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === 'INPUT' && (
            <motion.div
              key="input"
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -20}}
              transition={{duration: 0.3, ease: [0.16, 1, 0.3, 1]}}
            >
              {/* Phase 1: Flux Token Withdrawal */}
              {phase === 'FLUX' && (
                <>
                  {/* Portfolio Summary */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="glass-panel p-4 rounded-2xl border border-[rgba(23,20,20,0.08)] bg-white/60">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="stat-icon-ring" style={{width: 28, height: 28, borderRadius: 8}}>
                          <Layers className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4A4A4A] font-['Manrope',sans-serif]">Your Flux</span>
                      </div>
                      <p className="text-lg font-extrabold text-[#171414] font-['Manrope',sans-serif]">
                        {userShareBalance > 0 ? userShareBalance.toFixed(4) : '0'}
                      </p>
                      <p className="text-[10px] text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">
                        {userShareBalance > 0 ? `≈ ${userAssetValue.toFixed(6)} FXRP` : 'No tokens yet'}
                      </p>
                    </div>
                    <div className="glass-panel p-4 rounded-2xl border border-[rgba(23,20,20,0.08)] bg-white/60">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="stat-icon-ring" style={{width: 28, height: 28, borderRadius: 8}}>
                          <TrendingUp className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4A4A4A] font-['Manrope',sans-serif]">Token Value</span>
                      </div>
                      <p className="text-lg font-extrabold text-[#171414] font-['Manrope',sans-serif]">
                        {sharePrice.toFixed(6)}
                      </p>
                      <p className="text-[10px] text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">FXRP per Flux</p>
                    </div>
                  </div>

                  {/* Main Card */}
                  <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[rgba(23,20,20,0.1)] shadow-soft-editorial bg-white/60">
                    {/* Amount Input */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4A4A4A] font-['Manrope',sans-serif]">
                          FXRP Amount to Withdraw
                        </label>
                        <button
                          onClick={handleMax}
                          className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#E1BAC2] hover:text-[#171414] transition-colors font-['Manrope',sans-serif]"
                        >
                          MAX
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => {setAmount(e.target.value); setError(null);}}
                          placeholder="0.00"
                          min="0"
                          step="any"
                          className="w-full px-5 py-4 rounded-2xl bg-white/80 border border-[rgba(23,20,20,0.1)] text-xl font-extrabold text-[#171414] placeholder:text-[#4A4A4A]/30 focus:outline-none focus:border-[#E1BAC2] focus:shadow-[0_0_0_3px_rgba(225,186,194,0.15)] transition-all font-['Manrope',sans-serif]"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          <img src={xrpImg} alt="" className="w-6 h-6 object-contain" />
                          <span className="text-xs font-bold text-[#4A4A4A] font-mono">
                            FXRP
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">
                          Max: {maxWithdrawFormatted.toFixed(6)} FXRP
                        </span>
                        {previewShares && previewShares > 0n && (
                          <span className="text-[10px] text-[#4A4A4A] font-mono">
                            Burns {previewSharesFormatted.toFixed(6)} Flux
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Preview */}
                    {amount && parseFloat(amount) > 0 && (
                      <motion.div
                        initial={{opacity: 0, height: 0}}
                        animate={{opacity: 1, height: 'auto'}}
                        className="mb-6 p-4 rounded-2xl bg-[#F5F5F3] border border-[rgba(23,20,20,0.06)]"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4A4A4A] mb-3 font-['Manrope',sans-serif]">
                          Transaction Preview
                        </p>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">Withdrawing</span>
                            <span className="font-bold text-[#171414] font-mono">{parseFloat(amount).toFixed(6)} FXRP</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">Flux burned</span>
                            <span className="font-bold text-[#171414] font-mono">{previewSharesFormatted.toFixed(6)}</span>
                          </div>
                          <div className="flex justify-between text-xs pt-2 border-t border-[rgba(23,20,20,0.06)]">
                            <span className="text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">Remaining Flux</span>
                            <span className="font-bold text-[#171414] font-mono">
                              {(userShareBalance - previewSharesFormatted).toFixed(6)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Error */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{opacity: 0, y: -8}}
                          animate={{opacity: 1, y: 0}}
                          exit={{opacity: 0}}
                          className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 mb-4"
                        >
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          <p className="text-xs text-red-700 font-['Hanken_Grotesk',sans-serif]">{error}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Info Box */}
                    <div className="p-4 rounded-2xl bg-[#F5F5F3] border border-[rgba(23,20,20,0.06)] mb-6">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-[#4A4A4A] mt-0.5 shrink-0" />
                        <div className="text-xs text-[#4A4A4A] leading-relaxed font-['Hanken_Grotesk',sans-serif] space-y-1">
                          <p>
                            Withdraw FXRP to your wallet. You can then bridge it back to native XRP via the FAsset system.
                          </p>
                          <p className="text-[10px] opacity-70">
                            FXRP can be converted to native XRP through Flare's FAsset bridge.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      onClick={handleWithdraw}
                      disabled={!amount || parseFloat(amount) <= 0 || userShareBalance === 0}
                      className="w-full py-4 rounded-full bg-[#171414] text-[#E1BAC2] text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-[#000000] transition-all shadow-md hover:shadow-[0_4px_16px_rgba(225,186,194,0.25)] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed font-['Manrope',sans-serif]"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      Withdraw FXRP
                    </button>

                    {userShareBalance === 0 && (
                      <p className="text-center text-[10px] text-[#4A4A4A] mt-3 font-['Hanken_Grotesk',sans-serif]">
                        You don't have any Flux tokens to withdraw.{' '}
                        <button onClick={onBack} className="text-[#E1BAC2] hover:underline font-semibold">
                          Go to Dashboard
                        </button>
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Phase 2: C2FLR Withdrawal */}
              {phase === 'C2FLR' && (
                <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[rgba(23,20,20,0.1)] shadow-soft-editorial bg-white/60">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-[#171414] flex items-center justify-center mx-auto mb-4">
                      <Zap className="w-8 h-8 text-[#E1BAC2]" />
                    </div>
                    <h3 className="text-xl font-extrabold text-[#171414] mb-2" style={{fontFamily: 'Manrope, sans-serif'}}>
                      C2FLR Gas Token
                    </h3>
                    <p className="text-xs text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">
                      C2FLR is used to pay for transaction fees on Flare Network
                    </p>
                  </div>

                  {/* Balance Display */}
                  <div className="p-5 rounded-2xl bg-[#F5F5F3] border border-[rgba(23,20,20,0.06)] mb-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">Your C2FLR Balance</span>
                      <span className="text-xl font-extrabold text-[#171414] font-mono">
                        {c2flrBalance.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">Network</span>
                      <span className="text-xs font-bold text-emerald-600">Flare Coston2 Testnet</span>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="p-4 rounded-2xl bg-[#F5F5F3] border border-[rgba(23,20,20,0.06)] mb-6">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[#4A4A4A] mt-0.5 shrink-0" />
                      <div className="text-xs text-[#4A4A4A] leading-relaxed font-['Hanken_Grotesk',sans-serif]">
                        <p className="mb-2">
                          C2FLR is the native gas token on Flare Coston2 testnet. It's required to pay for transaction fees when interacting with Flux Protocol.
                        </p>
                        <p className="font-bold">
                          To get C2FLR, use the official Flare faucet:
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Faucet Link */}
                  <a
                    href="https://faucet.flare.network"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 rounded-full bg-[#171414] text-[#E1BAC2] text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-[#000000] transition-all shadow-md hover:shadow-[0_4px_16px_rgba(225,186,194,0.25)] flex items-center justify-center gap-2 font-['Manrope',sans-serif]"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Visit Flare Faucet
                  </a>

                  <p className="text-center text-[10px] text-[#4A4A4A] mt-4 font-['Hanken_Grotesk',sans-serif]">
                    The faucet provides free C2FLR for testing on the Coston2 testnet
                  </p>
                </div>
              )}

              {/* How Withdrawals Work */}
              <div className="mt-6 glass-panel p-5 rounded-2xl border border-[rgba(23,20,20,0.06)] bg-white/40">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-3.5 h-3.5 text-[#E1BAC2]" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4A4A4A] font-['Manrope',sans-serif]">
                    {phase === 'FLUX' ? 'How Withdrawals Work' : 'About C2FLR'}
                  </p>
                </div>
                <div className="space-y-2">
                  {phase === 'FLUX' ? (
                    <>
                      {[
                        'The vault checks its idle balance first for instant withdrawal',
                        'If insufficient, funds are pulled from the active strategy (may incur slippage)',
                        'A 5% liquidity buffer is maintained for standard-sized withdrawals',
                        'FXRP is transferred to your wallet — bridge to native XRP via FAsset',
                      ].map((text, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E1BAC2] mt-1.5 shrink-0" />
                          <p className="text-[11px] text-[#4A4A4A] leading-relaxed font-['Hanken_Grotesk',sans-serif]">{text}</p>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      {[
                        'C2FLR is the native gas token for Flare Network',
                        'Used to pay transaction fees for all on-chain operations',
                        'Get free C2FLR from the official Flare faucet',
                        'Testnet tokens have no real value — safe for testing',
                      ].map((text, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E1BAC2] mt-1.5 shrink-0" />
                          <p className="text-[11px] text-[#4A4A4A] leading-relaxed font-['Hanken_Grotesk',sans-serif]">{text}</p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {step === 'CONFIRMING' && (
            <motion.div
              key="confirming"
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -20}}
              className="glass-panel p-8 rounded-3xl border border-[rgba(23,20,20,0.1)] shadow-soft-editorial bg-white/60 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-[#171414] flex items-center justify-center mx-auto mb-4 animate-spin">
                <RefreshCw className="w-8 h-8 text-[#E1BAC2]" />
              </div>
              <h3 className="text-xl font-extrabold text-[#171414] mb-2" style={{fontFamily: 'Manrope, sans-serif'}}>
                {isWritePending ? 'Confirm in Wallet' : 'Processing Withdrawal'}
              </h3>
              <p className="text-xs text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">
                {isWritePending
                  ? 'Please confirm the transaction in your wallet'
                  : 'Your withdrawal is being confirmed on-chain...'
                }
              </p>
              {writeHash && (
                <p className="text-[10px] text-[#4A4A4A] font-mono mt-3 opacity-60">
                  TX: {writeHash.slice(0, 10)}...{writeHash.slice(-6)}
                </p>
              )}
            </motion.div>
          )}

          {step === 'SUCCESS' && (
            <motion.div
              key="success"
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -20}}
              className="glass-panel p-6 sm:p-8 rounded-3xl border border-emerald-500/30 shadow-soft-editorial bg-white/60"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-extrabold text-[#171414] mb-1" style={{fontFamily: 'Manrope, sans-serif'}}>
                  Withdrawal Complete!
                </h3>
                <p className="text-xs text-emerald-700 font-mono font-bold">
                  {`${parseFloat(amount).toFixed(6)} FXRP withdrawn`}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/70 border border-[rgba(23,20,20,0.1)] mb-6 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">Type</span>
                  <span className="font-bold text-[#171414]">FXRP Withdrawal</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">Network</span>
                  <span className="font-mono text-emerald-700 font-bold">Flare Coston2 Testnet</span>
                </div>
                {txHash && (
                  <div className="flex justify-between">
                    <span className="text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">Transaction</span>
                    <a
                      href={`https://coston2-explorer.flare.network/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[#E1BAC2] hover:underline flex items-center gap-1"
                    >
                      {txHash.slice(0, 8)}...{txHash.slice(-6)}
                      <ArrowRight className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onBack}
                  className="py-3 rounded-full bg-[#171414] text-[#E1BAC2] text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-[#000000] transition-all font-['Manrope',sans-serif]"
                >
                  View Dashboard
                </button>
                <button
                  onClick={handleReset}
                  className="py-3 rounded-full border border-[rgba(23,20,20,0.15)] text-[#171414] text-[11px] font-bold uppercase tracking-[0.15em] hover:border-[#E1BAC2] transition-all font-['Manrope',sans-serif]"
                >
                  Withdraw More
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};
