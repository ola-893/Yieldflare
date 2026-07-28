import React, {useState, useEffect} from 'react';
import {useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract} from 'wagmi';
import {decodeEventLog} from 'viem';
import {motion, AnimatePresence} from 'motion/react';
import {Lock, RefreshCw, Check, ArrowRight, Copy, Clock, AlertCircle} from 'lucide-react';
import xrpImg from '../assets/images/xrp.webp';
import btcImg from '../assets/images/btc.webp';
import {CONTRACTS, FASSET_ADAPTER_ABI, ASSET_MANAGER_ABI} from '../config/contracts';

const RESERVATION_FEE = 0n; // Would read from contract

type DepositStep = 'SELECT' | 'RESERVE_TAG' | 'AWAITING_DEPOSIT' | 'READY_TO_SETTLE' | 'SETTLING' | 'COMPLETE';

interface DepositPageProps {
  onBack: () => void;
}

// Fetches the FAsset Core Vault XRPL address from Flare's AssetManager contract
const useCoreVaultAddress = () => {
  const {data: coreVaultAddress, isLoading, error} = useReadContract({
    address: CONTRACTS.assetManagerFXRP,
    abi: ASSET_MANAGER_ABI,
    functionName: 'directMintingPaymentAddress',
    query: {refetchInterval: false},
  });
  return {coreVaultAddress: coreVaultAddress as string | undefined, isLoading, error};
};

export const DepositPage: React.FC<DepositPageProps> = ({onBack}) => {
  const {address, isConnected} = useAccount();
  const [step, setStep] = useState<DepositStep>('SELECT');
  const [asset, setAsset] = useState<'XRP' | 'BTC'>('XRP');
  const [reservedTag, setReservedTag] = useState<string | null>(null);
  const [depositId, setDepositId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Persist state across refreshes
  useEffect(() => {
    const saved = localStorage.getItem('flux-deposit-state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.step && parsed.tag) {
          setStep(parsed.step);
          setReservedTag(parsed.tag);
          setAsset(parsed.asset || 'XRP');
          setDepositId(parsed.depositId || null);
        }
      } catch { /* ignore */ }
    }
  }, []);

  const saveState = (s: DepositStep, tag?: string, depId?: string) => {
    localStorage.setItem('flux-deposit-state', JSON.stringify({
      step: s,
      tag: tag || reservedTag,
      asset,
      depositId: depId || depositId,
    }));
  };

  // Register minting tag
  const {writeContract: registerTag, data: registerHash, isPending: isRegistering} = useWriteContract();
  const {isLoading: isRegisterConfirming, data: registerReceipt} = useWaitForTransactionReceipt({hash: registerHash});

  // Settle direct mint
  const {writeContract: settleMint, data: settleHash, isPending: isSettling} = useWriteContract();
  const {isLoading: isSettleConfirming} = useWaitForTransactionReceipt({hash: settleHash});

  // Poll for pending deposit (only when contract address is deployed)
  const isDeployed = CONTRACTS.fAssetAdapter !== '0x0000000000000000000000000000000000000000';
  const {data: pendingDepositRaw} = useReadContract({
    address: CONTRACTS.fAssetAdapter,
    abi: FASSET_ADAPTER_ABI as any,
    functionName: 'pendingDepositForTag',
    args: reservedTag ? [BigInt(reservedTag)] : undefined,
    query: {
      enabled: isDeployed && !!reservedTag && step === 'AWAITING_DEPOSIT',
      refetchInterval: 5000,
    },
  });
  const pendingDeposit = pendingDepositRaw as string | undefined;

  // Check if deposit is ready to settle
  useEffect(() => {
    if (pendingDeposit && pendingDeposit !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      setDepositId(pendingDeposit);
      setStep('READY_TO_SETTLE');
      saveState('READY_TO_SETTLE', undefined, pendingDeposit);
    }
  }, [pendingDeposit]);

  // After registration tx confirms, extract real tag from MintingTagRegistered event logs
  useEffect(() => {
    if (registerReceipt && !isRegisterConfirming && step === 'RESERVE_TAG') {
      try {
        let actualTag: string = '';
        for (const log of registerReceipt.logs) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const decoded: any = decodeEventLog({
              abi: FASSET_ADAPTER_ABI as any,
              data: log.data,
              topics: log.topics,
            });
            if (decoded?.eventName === 'MintingTagRegistered') {
              actualTag = decoded.args.tag.toString();
              break;
            }
          } catch (e) {
            // ignore logs that can't be decoded
          }
        }

        if (actualTag) {
          setReservedTag(actualTag);
          setStep('AWAITING_DEPOSIT');
          saveState('AWAITING_DEPOSIT', actualTag);
        } else {
          console.error('MintingTagRegistered event not found in receipt logs');
        }
      } catch (err) {
        console.error('Error parsing receipt:', err);
      }
    }
  }, [registerReceipt, isRegisterConfirming, step]);

  // After settle tx confirms
  useEffect(() => {
    if (settleHash && !isSettleConfirming) {
      setStep('COMPLETE');
      saveState('COMPLETE');
    }
  }, [settleHash, isSettleConfirming]);

  const handleReserveTag = () => {
    registerTag({
      address: CONTRACTS.fAssetAdapter,
      abi: FASSET_ADAPTER_ABI as any,
      functionName: 'registerMintingTag',
      value: RESERVATION_FEE,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    setStep('RESERVE_TAG');
  };

  const handleSettle = () => {
    if (!depositId) return;
    settleMint({
      address: CONTRACTS.fAssetAdapter,
      abi: FASSET_ADAPTER_ABI as any,
      functionName: 'settleDirectMint',
      args: [depositId as `0x${string}`],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    setStep('SETTLING');
  };

  const handleCopyTag = () => {
    if (reservedTag) {
      navigator.clipboard.writeText(reservedTag);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    localStorage.removeItem('flux-deposit-state');
    setStep('SELECT');
    setReservedTag(null);
    setDepositId(null);
  };

  // Fetch the FAsset Core Vault XRPL address (must be above early return per React Rules of Hooks)
  const {coreVaultAddress, isLoading: isVaultLoading} = useCoreVaultAddress();
  const [vaultCopied, setVaultCopied] = useState(false);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#F5F5F3] flex items-center justify-center pt-24">
        <div className="text-center">
          <Lock className="w-16 h-16 text-[#4A4A4A] mx-auto mb-4" />
          <h2 className="text-2xl font-extrabold text-[#1E1E1E] mb-2" style={{fontFamily: 'Manrope, sans-serif'}}>
            Connect your wallet
          </h2>
          <p className="text-sm text-[#4A4A4A] mb-6">Connect to start depositing</p>
          <button onClick={onBack} className="text-xs font-bold text-[#E1BAC2] hover:underline">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleCopyVaultAddress = () => {
    if (coreVaultAddress) {
      navigator.clipboard.writeText(coreVaultAddress);
      setVaultCopied(true);
      setTimeout(() => setVaultCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F3] pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">

        {/* Back button */}
        <button onClick={onBack} className="flex items-center gap-2 text-xs font-bold text-[#4A4A4A] hover:text-[#1E1E1E] transition-colors mb-8">
          ← Back to Dashboard
        </button>

        {/* Header */}
        <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#1E1E1E]/20 text-[#1E1E1E] text-[10px] font-mono font-bold uppercase tracking-wider mb-3 bg-white/40">
            <Lock className="w-3 h-3 text-[#E1BAC2]" />
            <span>FAsset Deposit Flow</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#1E1E1E]" style={{fontFamily: 'Manrope, sans-serif'}}>
            Deposit Native Assets
          </h1>
          <p className="text-sm text-[#4A4A4A] mt-2">
            Send native XRP or BTC → FAssets are minted → ParentVault shares are issued
          </p>
        </motion.div>

        {/* Step Indicator */}
        <StepIndicator currentStep={step} />

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {step === 'SELECT' && (
            <StepSelectAsset
              key="select"
              asset={asset}
              setAsset={setAsset}
              onReserve={handleReserveTag}
              isRegistering={isRegistering || isRegisterConfirming}
            />
          )}

          {step === 'RESERVE_TAG' && (
            <StepReserving key="reserving" />
          )}

          {step === 'AWAITING_DEPOSIT' && (
            <StepAwaitingDeposit
              key="awaiting"
              tag={reservedTag!}
              asset={asset}
              coreVaultAddress={coreVaultAddress}
              isVaultLoading={isVaultLoading}
              onCopyTag={handleCopyTag}
              onCopyVaultAddress={handleCopyVaultAddress}
              vaultCopied={vaultCopied}
              copied={copied}
            />
          )}

          {step === 'READY_TO_SETTLE' && (
            <StepReadyToSettle
              key="settle"
              depositId={depositId!}
              onSettle={handleSettle}
              isSettling={isSettling || isSettleConfirming}
            />
          )}

          {step === 'SETTLING' && (
            <StepSettling key="settling" />
          )}

          {step === 'COMPLETE' && (
            <StepComplete key="complete" asset={asset} onReset={handleReset} onBack={onBack} />
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

// Step Indicator
const StepIndicator: React.FC<{currentStep: DepositStep}> = ({currentStep}) => {
  const steps = [
    {id: 'SELECT', label: 'Select'},
    {id: 'RESERVE_TAG', label: 'Reserve Tag'},
    {id: 'AWAITING_DEPOSIT', label: 'Awaiting'},
    {id: 'READY_TO_SETTLE', label: 'Settle'},
    {id: 'COMPLETE', label: 'Complete'},
  ];

  const stepOrder: DepositStep[] = ['SELECT', 'RESERVE_TAG', 'AWAITING_DEPOSIT', 'READY_TO_SETTLE', 'SETTLING', 'COMPLETE'];
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="flex items-center justify-between mb-10 px-2">
      {steps.map((s, i) => {
        const isActive = stepOrder.indexOf(s.id as DepositStep) <= currentIndex;
        return (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                isActive ? 'bg-[#1E1E1E] text-[#F5F5F3]' : 'bg-[#1E1E1E]/10 text-[#4A4A4A]'
              }`}>
                {isActive ? '✓' : i + 1}
              </div>
              <span className={`text-[9px] font-mono uppercase tracking-wider ${isActive ? 'text-[#1E1E1E] font-bold' : 'text-[#4A4A4A]'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-2 ${isActive ? 'bg-[#1E1E1E]' : 'bg-[#1E1E1E]/10'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Step 1: Select Asset
const StepSelectAsset: React.FC<{
  asset: 'XRP' | 'BTC';
  setAsset: (a: 'XRP' | 'BTC') => void;
  onReserve: () => void;
  isRegistering: boolean;
}> = ({asset, setAsset, onReserve, isRegistering}) => (
  <motion.div
    initial={{opacity: 0, y: 20}}
    animate={{opacity: 1, y: 0}}
    exit={{opacity: 0, y: -20}}
    className="glass-panel p-6 sm:p-8 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial bg-white/60"
  >
    <h3 className="text-lg font-bold text-[#1E1E1E] mb-1" style={{fontFamily: 'Manrope, sans-serif'}}>
      Select deposit asset
    </h3>
    <p className="text-xs text-[#4A4A4A] mb-6">Choose the native asset you want to deposit</p>

    <div className="grid grid-cols-2 gap-4 mb-8">
      <AssetOption
        name="XRP"
        img={xrpImg}
        description="Routed to Kinetic Lending via FXRP"
        isSelected={asset === 'XRP'}
        onClick={() => setAsset('XRP')}
      />
      <AssetOption
        name="BTC"
        img={btcImg}
        description="Routed to Enosys DEX via FBTC"
        isSelected={asset === 'BTC'}
        onClick={() => setAsset('BTC')}
      />
    </div>

    <div className="p-4 rounded-2xl bg-[#F5F5F3] border border-[#1E1E1E]/10 mb-6">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-[#4A4A4A] mt-0.5 shrink-0" />
        <p className="text-xs text-[#4A4A4A] leading-relaxed">
          This will reserve a unique minting tag on Flare. You'll then send native {asset} from your non-EVM wallet (e.g., Xumm) using this tag. The FAsset system will mint {asset === 'XRP' ? 'FXRP' : 'FBTC'} and route it to the ParentVault.
        </p>
      </div>
    </div>

    <button
      onClick={onReserve}
      disabled={isRegistering}
      className="w-full py-3.5 rounded-full bg-[#1E1E1E] text-[#F5F5F3] text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-[#000000] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
    >
      {isRegistering ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Confirming Transaction...</span>
        </>
      ) : (
        <>
          <span>Reserve Minting Tag</span>
          <ArrowRight className="w-4 h-4" />
        </>
      )}
    </button>
  </motion.div>
);

// Step: Reserving Tag
const StepReserving: React.FC = () => (
  <motion.div
    initial={{opacity: 0, y: 20}}
    animate={{opacity: 1, y: 0}}
    exit={{opacity: 0, y: -20}}
    className="glass-panel p-8 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial bg-white/60 text-center"
  >
    <div className="w-16 h-16 rounded-full bg-[#1E1E1E] text-[#F5F5F3] flex items-center justify-center mx-auto mb-4 animate-spin">
      <RefreshCw className="w-8 h-8 text-[#E1BAC2]" />
    </div>
    <h3 className="text-xl font-extrabold text-[#1E1E1E] mb-2" style={{fontFamily: 'Manrope, sans-serif'}}>
      Reserving your minting tag
    </h3>
    <p className="text-xs text-[#4A4A4A]">
      Confirm the transaction in your wallet. This registers a unique destination tag on Flare's MintingTagManager.
    </p>
  </motion.div>
);

// Step: Awaiting Deposit
const StepAwaitingDeposit: React.FC<{
  tag: string;
  asset: 'XRP' | 'BTC';
  coreVaultAddress: string | undefined;
  isVaultLoading: boolean;
  onCopyTag: () => void;
  onCopyVaultAddress: () => void;
  vaultCopied: boolean;
  copied: boolean;
}> = ({tag, asset, coreVaultAddress, isVaultLoading, onCopyTag, onCopyVaultAddress, vaultCopied, copied}) => (
  <motion.div
    initial={{opacity: 0, y: 20}}
    animate={{opacity: 1, y: 0}}
    exit={{opacity: 0, y: -20}}
    className="glass-panel p-6 sm:p-8 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial bg-white/60"
  >
    <div className="text-center mb-8">
      <div className="w-16 h-16 rounded-full bg-[#E1BAC2]/10 border border-[#E1BAC2]/30 flex items-center justify-center mx-auto mb-4">
        <Clock className="w-8 h-8 text-[#E1BAC2] animate-pulse" />
      </div>
      <h3 className="text-xl font-extrabold text-[#1E1E1E] mb-2" style={{fontFamily: 'Manrope, sans-serif'}}>
        Send native {asset} to mint FAssets
      </h3>
      <p className="text-xs text-[#4A4A4A]">
        Your tag is reserved. Send {asset} from your non-EVM wallet using the tag below.
      </p>
    </div>

    {/* Tag Display */}
    <div className="p-5 rounded-2xl bg-[#1E1E1E] text-[#F5F5F3] mb-6">
      <p className="text-[10px] font-mono text-[#E1BAC2] uppercase tracking-wider mb-2">Your Minting Tag</p>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-mono font-bold">{tag}</span>
        <button
          onClick={onCopyTag}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>      {/* Instructions */}
    <div className="space-y-3 mb-6">
      <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
        <span className="w-5 h-5 rounded-full bg-[#1E1E1E] text-[#F5F5F3] flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
        <p className="text-xs text-[#1E1E1E]">Open your {asset === 'XRP' ? 'XRP ' : 'Bitcoin'} wallet</p>
      </div>
      <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
        <span className="w-5 h-5 rounded-full bg-[#1E1E1E] text-[#F5F5F3] flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
        <div className="flex-1">
          <p className="text-xs text-[#1E1E1E]">Send {asset} to the FAsset Core Vault with destination tag: <strong>{tag}</strong></p>
          {/* Core Vault Address Display */}
          <div className="mt-2 p-3 rounded-xl bg-[#1E1E1E] text-[#F5F5F3]">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-mono text-[#E1BAC2] uppercase tracking-wider">Core Vault Address ({asset === 'XRP' ? 'XRPL' : 'BTC'})</p>
              <button
                onClick={onCopyVaultAddress}
                className="p-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
              >
                {vaultCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            {isVaultLoading ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3 h-3 animate-spin text-[#E1BAC2]" />
                <span className="text-[10px] font-mono text-white/50">Fetching from AssetManager...</span>
              </div>
            ) : coreVaultAddress ? (
              <p className="text-[11px] font-mono font-bold break-all leading-relaxed">
                {coreVaultAddress}
              </p>
            ) : (
              <p className="text-[10px] font-mono text-red-400">
                Unable to fetch address — check Flare AssetManager
              </p>
            )}
          </div>
          <p className="text-[10px] text-[#4A4A4A] mt-1.5">
            This is Flare's FAsset Direct Minting deposit address. Payments here are automatically routed to your vault via the destination tag.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F5F5F3] border border-[#1E1E1E]/10">
        <span className="w-5 h-5 rounded-full bg-[#1E1E1E] text-[#F5F5F3] flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
        <p className="text-xs text-[#1E1E1E]">Wait for FAsset attestation — this page will update automatically</p>
      </div>
    </div>

    <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-[#4A4A4A]">
      <span className="w-2 h-2 rounded-full bg-[#E1BAC2] animate-pulse" />
      Polling for deposit confirmation...
    </div>
  </motion.div>
);

// Step: Ready to Settle
const StepReadyToSettle: React.FC<{
  depositId: string;
  onSettle: () => void;
  isSettling: boolean;
}> = ({depositId, onSettle, isSettling}) => (
  <motion.div
    initial={{opacity: 0, y: 20}}
    animate={{opacity: 1, y: 0}}
    exit={{opacity: 0, y: -20}}
    className="glass-panel p-6 sm:p-8 rounded-3xl border border-emerald-500/30 shadow-soft-editorial bg-white/60"
  >
    <div className="text-center mb-8">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
        <Check className="w-8 h-8 text-emerald-600" />
      </div>
      <h3 className="text-xl font-extrabold text-[#1E1E1E] mb-2" style={{fontFamily: 'Manrope, sans-serif'}}>
        FAssets received!
      </h3>
      <p className="text-xs text-[#4A4A4A]">
        Your deposit has been processed. Click below to settle and receive your ERC-4626 vault shares.
      </p>
    </div>

    <div className="p-4 rounded-2xl bg-[#F5F5F3] border border-[#1E1E1E]/10 mb-6">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#4A4A4A]">Deposit ID:</span>
        <span className="font-mono text-[#1E1E1E]">{depositId.slice(0, 10)}...{depositId.slice(-6)}</span>
      </div>
    </div>

    <button
      onClick={onSettle}
      disabled={isSettling}
      className="w-full py-3.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-emerald-700 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
    >
      {isSettling ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Settling Deposit...</span>
        </>
      ) : (
        <>
          <span>Settle & Receive Shares</span>
          <ArrowRight className="w-4 h-4" />
        </>
      )}
    </button>
  </motion.div>
);

// Step: Settling
const StepSettling: React.FC = () => (
  <motion.div
    initial={{opacity: 0, y: 20}}
    animate={{opacity: 1, y: 0}}
    exit={{opacity: 0, y: -20}}
    className="glass-panel p-8 rounded-3xl border border-[#1E1E1E]/15 shadow-soft-editorial bg-white/60 text-center"
  >
    <div className="w-16 h-16 rounded-full bg-[#1E1E1E] text-[#F5F5F3] flex items-center justify-center mx-auto mb-4 animate-spin">
      <RefreshCw className="w-8 h-8 text-[#E1BAC2]" />
    </div>
    <h3 className="text-xl font-extrabold text-[#1E1E1E] mb-2" style={{fontFamily: 'Manrope, sans-serif'}}>
      Settling your deposit
    </h3>
    <p className="text-xs text-[#4A4A4A]">
      Transferring FAssets to the ParentVault and minting your ERC-4626 shares...
    </p>
  </motion.div>
);

// Step: Complete
const StepComplete: React.FC<{
  asset: 'XRP' | 'BTC';
  onReset: () => void;
  onBack: () => void;
}> = ({asset, onReset, onBack}) => (
  <motion.div
    initial={{opacity: 0, y: 20}}
    animate={{opacity: 1, y: 0}}
    exit={{opacity: 0, y: -20}}
    className="glass-panel p-6 sm:p-8 rounded-3xl border border-emerald-500/30 shadow-soft-editorial bg-white/60"
  >
    <div className="text-center mb-8">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
        <Check className="w-8 h-8 text-emerald-600" />
      </div>
      <h3 className="text-2xl font-extrabold text-[#1E1E1E] mb-1" style={{fontFamily: 'Manrope, sans-serif'}}>
        Deposit Complete!
      </h3>
      <p className="text-xs text-emerald-700 font-mono font-bold">
        Your ERC-4626 vault shares are now accruing yield on Flare Coston2 testnet.
      </p>
    </div>

    <div className="p-4 rounded-2xl bg-white/70 border border-[#1E1E1E]/15 mb-6 text-xs space-y-2">
      <div className="flex justify-between">
        <span className="text-[#4A4A4A]">Asset:</span>
        <span className="font-bold text-[#1E1E1E]">{asset === 'XRP' ? 'FXRP → Kinetic' : 'FBTC → Enosys'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#4A4A4A]">Network:</span>
        <span className="font-mono text-emerald-700 font-bold">Flare Coston2 Testnet</span>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={onBack}
        className="py-3 rounded-full bg-[#1E1E1E] text-[#F5F5F3] text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-[#000000] transition-all"
      >
        View Dashboard
      </button>
      <button
        onClick={onReset}
        className="py-3 rounded-full border border-[#1E1E1E]/20 text-[#1E1E1E] text-[11px] font-bold uppercase tracking-[0.15em] hover:border-[#E1BAC2] transition-all"
      >
        Deposit More
      </button>
    </div>
  </motion.div>
);

// Asset Option Card
const AssetOption: React.FC<{
  name: string;
  img: string;
  description: string;
  isSelected: boolean;
  onClick: () => void;
}> = ({name, img, description, isSelected, onClick}) => (
  <button
    onClick={onClick}
    className={`p-5 rounded-2xl border-2 transition-all text-left ${
      isSelected
        ? 'border-[#1E1E1E] bg-white shadow-md'
        : 'border-[#1E1E1E]/10 bg-white/40 hover:border-[#1E1E1E]/30'
    }`}
  >
    <div className="flex items-center gap-3 mb-2">
      <img src={img} alt={name} className="w-8 h-8 object-contain" />
      <span className="text-base font-bold text-[#1E1E1E]" style={{fontFamily: 'Manrope, sans-serif'}}>{name}</span>
    </div>
    <p className="text-[11px] text-[#4A4A4A]">{description}</p>
  </button>
);
