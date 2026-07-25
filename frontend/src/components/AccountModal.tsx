import React, {useState, useEffect} from 'react';
import {motion, AnimatePresence} from 'motion/react';
import {Copy, Check, LogOut, X, ExternalLink} from 'lucide-react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  balance: string;
  chainName: string;
  chainIconUrl?: string;
  disconnect: () => void;
  explorerUrl?: string;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  address,
  balance,
  chainName,
  chainIconUrl,
  disconnect,
  explorerUrl,
}) => {
  const [copied, setCopied] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = address;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    onClose();
  };

  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.2}}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-[#171414]/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{opacity: 0, scale: 0.95, y: 10}}
            animate={{opacity: 1, scale: 1, y: 0}}
            exit={{opacity: 0, scale: 0.95, y: 10}}
            transition={{duration: 0.25, ease: [0.16, 1, 0.3, 1]}}
            className="fixed z-[101] top-[72px] right-2 sm:right-5 w-[calc(100vw-16px)] sm:w-[320px] max-w-[320px]"
          >
            <div className="rounded-2xl bg-[#F5F5F3] border border-[rgba(23,20,20,0.1)] shadow-[0_24px_64px_rgba(23,20,20,0.12),0_4px_16px_rgba(23,20,20,0.06)] overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h3 className="text-sm font-extrabold tracking-[-0.02em] text-[#171414] font-['Manrope',sans-serif]">
                  Account
                </h3>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#4A4A4A] hover:text-[#171414] hover:bg-[rgba(23,20,20,0.06)] transition-all duration-200"
                  aria-label="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Address section */}
              <div className="px-5 pb-4">
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[rgba(23,20,20,0.03)] border border-[rgba(23,20,20,0.06)]">
                  {/* Gradient accent dot instead of icon */}
                  <div className="w-2 h-2 rounded-full bg-gradient-to-br from-[#E1BAC2] to-[#171414] flex-shrink-0 shadow-[0_0_8px_rgba(225,186,194,0.4)]" />

                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#4A4A4A] font-semibold font-['Manrope',sans-serif] mb-0.5">
                      Connected
                    </p>
                    <p className="text-sm font-bold text-[#171414] font-mono tracking-tight truncate">
                      {shortAddress}
                    </p>
                  </div>

                  <button
                    onClick={handleCopy}
                    className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[rgba(23,20,20,0.06)] transition-all duration-200 group"
                    title="Copy address"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[#4A4A4A] group-hover:text-[#171414]" />
                    )}
                  </button>
                </div>

                {/* Copied toast */}
                <AnimatePresence>
                  {copied && (
                    <motion.p
                      initial={{opacity: 0, y: -4}}
                      animate={{opacity: 1, y: 0}}
                      exit={{opacity: 0}}
                      className="text-[10px] text-emerald-600 font-semibold tracking-wide mt-2 font-['Manrope',sans-serif]"
                    >
                      Copied to clipboard
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 px-5">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[rgba(23,20,20,0.08)] to-transparent" />
                <div className="w-1 h-1 bg-[#E1BAC2] rotate-45 shadow-[0_0_6px_rgba(225,186,194,0.4)]" />
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[rgba(23,20,20,0.08)] to-transparent" />
              </div>

              {/* Network & Balance */}
              <div className="px-5 py-4 space-y-3">
                {/* Network */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-[#4A4A4A] font-semibold font-['Manrope',sans-serif]">
                    Network
                  </span>
                  <div className="flex items-center gap-2">
                    {chainIconUrl && (
                      <img
                        src={chainIconUrl}
                        alt={chainName}
                        className="w-4 h-4 rounded-full"
                      />
                    )}
                    <span className="text-xs font-bold text-[#171414] font-['Manrope',sans-serif]">
                      {chainName}
                    </span>
                  </div>
                </div>

                {/* Balance */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-[#4A4A4A] font-semibold font-['Manrope',sans-serif]">
                    Balance
                  </span>
                  <span className="text-xs font-bold text-[#171414] font-['Manrope',sans-serif]">
                    {balance}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 px-5">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[rgba(23,20,20,0.08)] to-transparent" />
                <div className="w-1 h-1 bg-[#E1BAC2] rotate-45 shadow-[0_0_6px_rgba(225,186,194,0.4)]" />
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[rgba(23,20,20,0.08)] to-transparent" />
              </div>

              {/* Actions */}
              <div className="px-5 py-4 space-y-2">
                {/* View on Explorer */}
                {explorerUrl && (
                  <a
                    href={`${explorerUrl}/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] text-[#171414] bg-[rgba(255,255,255,0.6)] border border-[rgba(23,20,20,0.1)] backdrop-blur-sm hover:bg-[rgba(255,255,255,0.9)] hover:border-[#E1BAC2] hover:shadow-[0_4px_16px_rgba(225,186,194,0.15)] transition-all duration-200 font-['Manrope',sans-serif]"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View on Explorer
                  </a>
                )}

                {/* Disconnect */}
                <button
                  onClick={handleDisconnect}
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] text-[#E1BAC2] bg-[#171414] border-none hover:bg-[#000000] hover:shadow-[0_4px_16px_rgba(225,186,194,0.25)] hover:-translate-y-px transition-all duration-200 cursor-pointer font-['Manrope',sans-serif]"
                >
                  <LogOut className="w-3 h-3" />
                  Disconnect
                </button>
              </div>

              {/* Footer accent */}
              <div className="h-0.5 bg-gradient-to-r from-transparent via-[#E1BAC2] to-transparent opacity-30" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
