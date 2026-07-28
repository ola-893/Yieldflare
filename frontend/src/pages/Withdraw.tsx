import React, {useState, useEffect} from 'react';
import {useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt} from 'wagmi';
import {formatUnits, parseUnits} from 'viem';
import {motion, AnimatePresence} from 'motion/react';
import {ArrowUpRight, RefreshCw, Check, AlertCircle, Wallet, Layers, TrendingUp, Clock, ArrowRight} from 'lucide-react';
import {CONTRACTS, PARENT_VAULT_ABI} from '../config/contracts';

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
  {
    name: 'redeem',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {name: 'shares', type: 'uint256'},
      {name: 'receiver', type: 'address'},
      {name: 'owner', type: 'address'},
    ],
    outputs: [{name: 'assets', type: 'uint256'}],
  },
];

const PARENT_VAULT_ADDRESS: `0x${string}` = CONTRACTS.parentVault;

type WithdrawMode = 'ASSET' | 'SHARE';
type WithdrawStep = 'INPUT' | 'CONFIRMING' | 'SUCCESS' | 'ERROR';

interface WithdrawPageProps {
  onBack: () => void;
}

export const WithdrawPage: React.FC<WithdrawPageProps> = ({onBack}) => {
  const {address, isConnected} = useAccount();
  const [mode, setMode] = useState<WithdrawMode>('ASSET');
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

  const {data: maxRedeemAmount} = useReadContract({
    address: PARENT_VAULT_ADDRESS,
    abi: PARENT_VAULT_ABI,
    functionName: 'maxRedeem',
    args: address ? [address] : undefined,
    query: {enabled: isDeployed && !!address},
  });

  // Preview conversions
  const parsedAmount = amount && !isNaN(parseFloat(amount)) ? parseUnits(amount, 18) : 0n;

  const {data: previewShares} = useReadContract({
    address: PARENT_VAULT_ADDRESS,
    abi: PARENT_VAULT_ABI,
    functionName: 'previewWithdraw',
    args: parsedAmount > 0n ? [parsedAmount] : undefined,
    query: {enabled: isDeployed && mode === 'ASSET' && parsedAmount > 0n},
  });

  const {data: previewAssets} = useReadContract({
    address: PARENT_VAULT_ADDRESS,
    abi: PARENT_VAULT_ABI,
    functionName: 'previewRedeem',
    args: parsedAmount > 0n ? [parsedAmount] : undefined,
    query: {enabled: isDeployed && mode === 'SHARE' && parsedAmount > 0n},
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

  // Handle transaction rejection/failure (pre-hash rejection + on-chain revert)
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

  // Timeout safety net for on-chain reverts (writeError won't catch these)
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
    ? Number(formatUnits(totalAssets, 18)) / Number(formatUnits(totalSupply, 18))
    : 1;

  const userShareBalance = userShares ? Number(formatUnits(userShares, 18)) : 0;
  const userAssetValue = userShareBalance * sharePrice;

  const maxWithdrawFormatted = maxWithdrawAmount ? Number(formatUnits(maxWithdrawAmount, 18)) : 0;
  const maxRedeemFormatted = maxRedeemAmount ? Number(formatUnits(maxRedeemAmount, 18)) : 0;

  const previewSharesFormatted = previewShares ? Number(formatUnits(previewShares, 18)) : 0;
  const previewAssetsFormatted = previewAssets ? Number(formatUnits(previewAssets, 18)) : 0;

  // ─── Validation ───
  const validateAmount = (): string | null => {
    if (!amount || parseFloat(amount) <= 0) return 'Enter an amount';
    const parsed = parseFloat(amount);

    if (mode === 'ASSET') {
      if (parsed > maxWithdrawFormatted) return `Maximum withdrawable: ${maxWithdrawFormatted.toFixed(6)} assets`;
    } else {
      if (parsed > maxRedeemFormatted) return `Maximum redeemable: ${maxRedeemFormatted.toFixed(6)} shares`;
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

    if (mode === 'ASSET') {
      writeContract({
        address: PARENT_VAULT_ADDRESS,
        abi: WITHDRAW_ABI,
        functionName: 'withdraw',
        args: [parsedAmount, address!, address!],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    } else {
      writeContract({
        address: PARENT_VAULT_ADDRESS,
        abi: WITHDRAW_ABI,
        functionName: 'redeem',
        args: [parsedAmount, address!, address!],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    }
    setStep('CONFIRMING');
  };

  const handleMax = () => {
    if (mode === 'ASSET') {
      setAmount(maxWithdrawFormatted > 0 ? maxWithdrawFormatted.toFixed(6) : '0');
    } else {
      setAmount(maxRedeemFormatted > 0 ? maxRedeemFormatted.toFixed(6) : '0');
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
            Redeem your ERC-4626 vault shares for underlying assets
          </p>
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
              {/* Portfolio Summary */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="glass-panel p-4 rounded-2xl border border-[rgba(23,20,20,0.08)] bg-white/60">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="stat-icon-ring" style={{width: 28, height: 28, borderRadius: 8}}>
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4A4A4A] font-['Manrope',sans-serif]">Your Shares</span>
                  </div>
                  <p className="text-lg font-extrabold text-[#171414] font-['Manrope',sans-serif]">
                    {userShareBalance > 0 ? userShareBalance.toFixed(4) : '0'}
                  </p>
                  <p className="text-[10px] text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">
                    {userShareBalance > 0 ? `≈ $${userAssetValue.toFixed(2)} value` : 'No deposits yet'}
                  </p>
                </div>
                <div className="glass-panel p-4 rounded-2xl border border-[rgba(23,20,20,0.08)] bg-white/60">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="stat-icon-ring" style={{width: 28, height: 28, borderRadius: 8}}>
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4A4A4A] font-['Manrope',sans-serif]">Share Price</span>
                  </div>
                  <p className="text-lg font-extrabold text-[#171414] font-['Manrope',sans-serif]">
                    ${sharePrice.toFixed(6)}
                  </p>
                  <p className="text-[10px] text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">Per ERC-4626 share</p>
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-1 p-1 rounded-full bg-white/40 border border-[rgba(23,20,20,0.06)] mb-6">
                <button
                  onClick={() => {setMode('ASSET'); setAmount(''); setError(null);}}
                  className={`flex-1 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] transition-all font-['Manrope',sans-serif] ${
                    mode === 'ASSET'
                      ? 'bg-[#171414] text-[#E1BAC2] shadow-md'
                      : 'text-[#4A4A4A] hover:text-[#171414]'
                  }`}
                >
                  Withdraw by Amount
                </button>
                <button
                  onClick={() => {setMode('SHARE'); setAmount(''); setError(null);}}
                  className={`flex-1 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] transition-all font-['Manrope',sans-serif] ${
                    mode === 'SHARE'
                      ? 'bg-[#171414] text-[#E1BAC2] shadow-md'
                      : 'text-[#4A4A4A] hover:text-[#171414]'
                  }`}
                >
                  Redeem by Shares
                </button>
              </div>

              {/* Main Card */}
              <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[rgba(23,20,20,0.1)] shadow-soft-editorial bg-white/60">

                {/* Amount Input */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4A4A4A] font-['Manrope',sans-serif]">
                      {mode === 'ASSET' ? 'Asset Amount to Withdraw' : 'Share Amount to Redeem'}
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
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#4A4A4A] font-mono">
                      {mode === 'ASSET' ? 'ASSETS' : 'SHARES'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">
                      {mode === 'ASSET'
                        ? `Max: ${maxWithdrawFormatted.toFixed(6)} assets`
                        : `Max: ${maxRedeemFormatted.toFixed(6)} shares`
                      }
                    </span>
                    {mode === 'ASSET' && previewShares && previewShares > 0n && (
                      <span className="text-[10px] text-[#4A4A4A] font-mono">
                        Burns {previewSharesFormatted.toFixed(6)} shares
                      </span>
                    )}
                    {mode === 'SHARE' && previewAssets && previewAssets > 0n && (
                      <span className="text-[10px] text-[#4A4A4A] font-mono">
                        Receives {previewAssetsFormatted.toFixed(6)} assets
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
                      {mode === 'ASSET' ? (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">Withdrawing</span>
                            <span className="font-bold text-[#171414] font-mono">{parseFloat(amount).toFixed(6)} assets</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">Shares burned</span>
                            <span className="font-bold text-[#171414] font-mono">{previewSharesFormatted.toFixed(6)}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">Redeeming</span>
                            <span className="font-bold text-[#171414] font-mono">{parseFloat(amount).toFixed(6)} shares</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">Assets received</span>
                            <span className="font-bold text-[#171414] font-mono">{previewAssetsFormatted.toFixed(6)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between text-xs pt-2 border-t border-[rgba(23,20,20,0.06)]">
                        <span className="text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">Remaining shares</span>
                        <span className="font-bold text-[#171414] font-mono">
                          {mode === 'ASSET'
                            ? (userShareBalance - previewSharesFormatted).toFixed(6)
                            : (userShareBalance - parseFloat(amount)).toFixed(6)
                          }
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
                        {mode === 'ASSET'
                          ? 'Withdraw specifies the exact amount of underlying assets you want to receive. The vault burns the corresponding shares.'
                          : 'Redeem specifies the exact number of shares to burn. You receive the proportional underlying assets.'
                        }
                      </p>
                      <p className="text-[10px] opacity-70">
                        If the vault's idle balance is insufficient, funds will be pulled from the active strategy. Large withdrawals may be subject to slippage.
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
                  {mode === 'ASSET' ? 'Withdraw Assets' : 'Redeem Shares'}
                </button>

                {userShareBalance === 0 && (
                  <p className="text-center text-[10px] text-[#4A4A4A] mt-3 font-['Hanken_Grotesk',sans-serif]">
                    You don't have any vault shares to withdraw.{' '}
                    <button onClick={onBack} className="text-[#E1BAC2] hover:underline font-semibold">
                      Go to Dashboard
                    </button>
                  </p>
                )}
              </div>

              {/* How Withdrawal Works */}
              <div className="mt-6 glass-panel p-5 rounded-2xl border border-[rgba(23,20,20,0.06)] bg-white/40">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-3.5 h-3.5 text-[#E1BAC2]" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4A4A4A] font-['Manrope',sans-serif]">
                    How Withdrawals Work
                  </p>
                </div>
                <div className="space-y-2">
                  {[
                    'The vault checks its idle balance first for instant withdrawal',
                    'If insufficient, funds are pulled from the active strategy (may incur slippage)',
                    'A 5% liquidity buffer is maintained for standard-sized withdrawals',
                    'Underlying assets are transferred directly to your wallet',
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E1BAC2] mt-1.5 shrink-0" />
                      <p className="text-[11px] text-[#4A4A4A] leading-relaxed font-['Hanken_Grotesk',sans-serif]">{text}</p>
                    </div>
                  ))}
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
                  {mode === 'ASSET' ? `${parseFloat(amount).toFixed(6)} assets` : `${parseFloat(amount).toFixed(6)} shares redeemed`}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/70 border border-[rgba(23,20,20,0.1)] mb-6 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#4A4A4A] font-['Hanken_Grotesk',sans-serif]">Mode</span>
                  <span className="font-bold text-[#171414]">{mode === 'ASSET' ? 'Withdraw by Amount' : 'Redeem by Shares'}</span>
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
