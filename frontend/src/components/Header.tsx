import React, {useState} from 'react';
import {ConnectButton} from '@rainbow-me/rainbowkit';
import {useAccount, useBalance, useDisconnect} from 'wagmi';
import {useNavigate, useLocation} from 'react-router-dom';
import {LayoutDashboard, ArrowDownToLine, ArrowUpFromLine, ChevronDown, BookOpen, Menu, X} from 'lucide-react';
import {motion, AnimatePresence} from 'motion/react';
import logoUrl from '../assets/logo/logo.webp';
import {AccountModal} from './AccountModal';
import {coston2} from '../config/wagmi';



interface HeaderProps {}

export const Header: React.FC<HeaderProps> = () => {
  const {isConnected, address} = useAccount();

  const {data: balanceData} = useBalance({address});
  const {disconnect} = useDisconnect();
  const navigate = useNavigate();
  const location = useLocation();
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isApp = isConnected && (location.pathname === '/' || location.pathname === '/deposit' || location.pathname === '/withdraw');


  const formattedBalance = balanceData
    ? `${parseFloat(balanceData.formatted).toFixed(4)} ${balanceData.symbol}`
    : '0.0000 C2FLR';

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 w-full px-3 pt-3 sm:px-5 sm:pt-5 pointer-events-none">
        <div className="max-w-7xl mx-auto h-14 px-4 sm:px-5 flex items-center justify-between rounded-full border border-white/45 bg-white/55 backdrop-blur-xl shadow-[0_18px_50px_rgba(30,30,30,0.08)] pointer-events-auto">

          {/* Logo — hidden on mobile, hamburger menu takes its place */}
          <button onClick={() => navigate(isApp ? '/' : '/')} className="hidden sm:flex items-center gap-2.5 group px-4 sm:px-5 py-2 rounded-full border border-[#171414] bg-[#171414]" aria-label="Flux home">
            <img src={logoUrl} alt="Flux" className="h-7 w-auto object-contain" />
          </button>

          {/* Nav — changes based on app state */}
          {isApp ? (
            <nav className="hidden md:flex items-center gap-1 rounded-full bg-white/35 p-1 text-[10px] uppercase tracking-[0.15em] font-bold text-[#4A4A4A]">
              {[
                {path: '/', label: 'Dashboard', icon: LayoutDashboard},
                {path: '/deposit', label: 'Deposit', icon: ArrowDownToLine},
                {path: '/withdraw', label: 'Withdraw', icon: ArrowUpFromLine},
                {path: '/docs', label: 'Docs', icon: BookOpen},
              ].map(({path, label, icon: Icon}) => {
                const isActive = location.pathname === path;
                return (
                  <button
                    key={path}
                    onClick={() => navigate(path)}
                    className={`relative rounded-full px-4 py-2 transition-all duration-200 flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-white/80 text-[#171414] shadow-sm'
                        : 'text-[#4A4A4A] hover:bg-white/50 hover:text-[#171414]'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 rounded-full bg-white/80 shadow-sm -z-10"
                        transition={{type: 'spring', stiffness: 400, damping: 30}}
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          ) : (
            <nav className="hidden md:flex items-center gap-1 rounded-full bg-white/35 p-1 text-[10px] uppercase tracking-[0.15em] font-bold text-[#4A4A4A]">
              <a href="#hero-disassembly" className="rounded-full px-4 py-2 hover:bg-white/60 hover:text-[#171414] transition-colors">Story</a>
              <a href="#how-it-works" className="rounded-full px-4 py-2 hover:bg-white/60 hover:text-[#171414] transition-colors">How It Works</a>
              <a href="#simulator" className="rounded-full px-4 py-2 hover:bg-white/60 hover:text-[#171414] transition-colors">Simulator</a>
              <a href="#vaults" className="rounded-full px-4 py-2 hover:bg-white/60 hover:text-[#171414] transition-colors">Vaults</a>
              <button onClick={() => navigate('/docs')} className="rounded-full px-4 py-2 hover:bg-white/60 hover:text-[#171414] transition-colors">DOCS</button>
            </nav>
          )}

          {/* Mobile menu toggle */}
          <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="md:hidden p-2 rounded-lg hover:bg-white/60 transition-colors mr-1" aria-label="Menu">
            {mobileNavOpen ? <X className="w-5 h-5 text-[#171414]" /> : <Menu className="w-5 h-5 text-[#171414]" />}
          </button>

          {/* Custom Connect Button — matches landing page pill aesthetic */}
          <ConnectButton.Custom>
            {({account, chain, openChainModal, openConnectModal, mounted}) => {
              const ready = mounted;
              const connected = ready && account && chain;

              return (
                <div
                  {...(!ready && {
                    'aria-hidden': true,
                    style: {opacity: 0, pointerEvents: 'none', userSelect: 'none'},
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button onClick={openConnectModal} className="flux-connect-btn">
                          Connect Wallet
                        </button>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <button onClick={openChainModal} className="flux-connect-btn flux-chain-badge--wrong" style={{background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.2)'}}>
                          Wrong Network
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      );
                    }

                    return (
                      <div className="flex items-center gap-2">
                        {/* Account pill — opens custom modal instead of RainbowKit's */}
                        <button onClick={() => setAccountModalOpen(true)} className="flux-connect-btn flux-connect-btn--connected">
                          <div className="flux-wallet-avatar" />
                          <span className="hidden sm:inline">
                            {account.displayName}
                          </span>
                          <span className="sm:hidden">
                            {account.address?.slice(0, 4)}...{account.address?.slice(-2)}
                          </span>
                          {account.displayBalance && (
                            <span className="hidden lg:inline text-[10px] opacity-60 ml-1">
                              {account.displayBalance}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>

        </div>
      </header>

      {/* Mobile Nav Drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 z-[55] bg-[#171414]/40 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{opacity: 0, y: -10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -10}}
              transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
              className="fixed top-[72px] left-3 right-3 z-[56] rounded-2xl bg-[#F5F5F3] border border-[rgba(23,20,20,0.1)] shadow-[0_24px_64px_rgba(23,20,20,0.12)] p-2 md:hidden"
            >
              {isApp ? (
                <>
                  {[{path: '/', label: 'Dashboard', icon: LayoutDashboard}, {path: '/deposit', label: 'Deposit', icon: ArrowDownToLine}, {path: '/withdraw', label: 'Withdraw', icon: ArrowUpFromLine}, {path: '/docs', label: 'Docs', icon: BookOpen}].map(({path, label, icon: Icon}) => (
                    <button
                      key={path}
                      onClick={() => {navigate(path); setMobileNavOpen(false);}}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-[0.1em] transition-all ${
                        location.pathname === path
                          ? 'bg-[#171414] text-[#E1BAC2]'
                          : 'text-[#4A4A4A] hover:bg-white/60 hover:text-[#171414]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {[{label: 'Story', href: '#hero-disassembly'}, {label: 'How It Works', href: '#how-it-works'}, {label: 'Simulator', href: '#simulator'}, {label: 'Vaults', href: '#vaults'}].map(({label, href}) => (
                    <a
                      key={label}
                      href={href}
                      onClick={() => setMobileNavOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-[0.1em] text-[#4A4A4A] hover:bg-white/60 hover:text-[#171414] transition-all"
                    >
                      {label}
                    </a>
                  ))}
                  <button
                    onClick={() => {navigate('/docs'); setMobileNavOpen(false);}}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-[0.1em] text-[#4A4A4A] hover:bg-white/60 hover:text-[#171414] transition-all"
                  >
                    <BookOpen className="w-4 h-4" />
                    Docs
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Custom Account Modal */}
      {address && (
        <AccountModal
          isOpen={accountModalOpen}
          onClose={() => setAccountModalOpen(false)}
          address={address}
          balance={formattedBalance}
          chainName={coston2.name}
          chainIconUrl={undefined}
          disconnect={disconnect}
          explorerUrl={coston2.blockExplorers.default.url}
        />
      )}
    </>
  );
};
