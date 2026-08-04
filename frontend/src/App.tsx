import React, {lazy, Suspense} from 'react';
import {Routes, Route, useNavigate, useLocation} from 'react-router-dom';
import {useAccount} from 'wagmi';
import {Header} from './components/Header';
import {HeroCanvas} from './components/HeroCanvas';
import {ProblemSection} from './components/ProblemSection';
import {HowItWorksSection} from './components/HowItWorksSection';
import {VaultSimulator} from './components/VaultSimulator';
import {SecurityTrustSection} from './components/SecurityTrustSection';

import {Footer} from './components/Footer';
import {useConnectModal} from '@rainbow-me/rainbowkit';

// Lazy-loaded route components for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({default: m.Dashboard})));
const DepositPage = lazy(() => import('./pages/Deposit').then(m => ({default: m.DepositPage})));
const Docs = lazy(() => import('./pages/Docs').then(m => ({default: m.Docs})));
const WithdrawPage = lazy(() => import('./pages/Withdraw').then(m => ({default: m.WithdrawPage})));

// Loading spinner for lazy routes
const RouteLoader = () => (
  <div className="min-h-screen bg-[#F5F5F3] flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-2 border-[#E1BAC2] border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-mono text-[#4A4A4A] uppercase tracking-widest">Loading...</p>
    </div>
  </div>
);

function LandingPage() {
  const navigate = useNavigate();
  const {openConnectModal} = useConnectModal();

  const handleScrollToVaults = () => {
    const vaultsSection = document.getElementById('vaults');
    if (vaultsSection) {
      vaultsSection.scrollIntoView({behavior: 'smooth'});
    } else if (openConnectModal) {
      openConnectModal();
    }
  };

  return (
    <>
      <Header />

      <main className="bg-[#F5F5F3]">
        <section id="hero-disassembly" className="relative bg-[#F5F5F3]">
          <HeroCanvas
            onExploreClick={handleScrollToVaults}
            onConnectWallet={openConnectModal}
          />
        </section>

        <ProblemSection />
        <HowItWorksSection onConnectWallet={openConnectModal} />
        <VaultSimulator onConnectWallet={openConnectModal} />
        <SecurityTrustSection />
      </main>

      <Footer />
    </>
  );
}

function AppPage() {
  const navigate = useNavigate();

  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              onNavigateToDeposit={() => navigate('/deposit')}
              onNavigateToWithdraw={() => navigate('/withdraw')}
            />
          }
        />
        <Route
          path="/deposit"
          element={<DepositPage onBack={() => navigate('/')} />}
        />
        <Route
          path="/withdraw"
          element={<WithdrawPage onBack={() => navigate('/')} />}
        />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  const {isConnected} = useAccount();
  const location = useLocation();

  // If wallet is connected and not on the landing page root, show app pages
  // If wallet is connected on root, show dashboard
  // If wallet is not connected, always show landing page
  const isDocsRoute = location.pathname === '/docs';

  if (isDocsRoute) {
    return (
      <Suspense fallback={<RouteLoader />}>
        <Docs />
      </Suspense>
    );
  }

  const isAppRoute = isConnected && (
    location.pathname === '/' ||
    location.pathname === '/deposit' ||
    location.pathname === '/withdraw'
  );

  if (isAppRoute) {
    return (
      <div className="min-h-screen bg-[#F5F5F3] text-[#171414] selection:bg-[#E1BAC2] selection:text-white font-sans antialiased">
        <Header />
        <AppPage />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F3] text-[#171414] selection:bg-[#E1BAC2] selection:text-white font-sans antialiased">
      <LandingPage />
    </div>
  );
}
