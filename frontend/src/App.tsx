import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

import { wagmiConfig } from './config/wagmi';
import { XrpWalletProvider } from './contexts/XrpWalletContext';
import Dashboard from './pages/Dashboard';
import Documentation from './pages/Documentation';

import './index.css';

const queryClient = new QueryClient();

function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <button id="wallet-btn" className="wallet-btn connected" onClick={() => disconnect()}>
        <span className="wallet-dot connected" />
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </button>
    );
  }

  return (
    <button
      id="connect-wallet-btn"
      className="wallet-btn"
      onClick={() => {
        const injected = connectors.find((c) => c.id === 'injected');
        if (injected) connect({ connector: injected });
      }}
    >
      <span className="wallet-dot disconnected" />
      Connect Wallet
    </button>
  );
}

function AppLayout() {
  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">F</div>
          <span className="sidebar-logo-text">FlareYield</span>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-title">Main</div>
          <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <span className="sidebar-link-icon">◈</span>
            <span className="sidebar-link-label">Dashboard</span>
          </NavLink>

          <div className="sidebar-section-title">Resources</div>
          <NavLink to="/docs" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <span className="sidebar-link-icon">📄</span>
            <span className="sidebar-link-label">Documentation</span>
          </NavLink>

          <a
            className="sidebar-link"
            href="https://flarescan.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="sidebar-link-icon">🔗</span>
            <span className="sidebar-link-label">FlareScan</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span className="badge live">
              <span className="pulse-dot" />
              Flare Mainnet
            </span>
          </div>
          <p style={{
            fontSize: '0.72rem',
            color: 'var(--color-text-muted)',
            marginTop: 'var(--space-sm)',
          }}>
            Chain ID: 14 · ERC-4626 Vault
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">
        <header className="header">
          <h1 className="header-title">
            <Routes>
              <Route path="/" element={<>Dashboard</>} />
              <Route path="/docs" element={<>Documentation</>} />
            </Routes>
          </h1>
          <div className="header-actions">
            <span className="badge tee">
              <span className="pulse-dot" style={{ background: '#818cf8' }} />
              FCC TEE
            </span>
            <WalletButton />
          </div>
        </header>

        <main className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/docs" element={<Documentation />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <XrpWalletProvider>
          <BrowserRouter>
            <AppLayout />
          </BrowserRouter>
        </XrpWalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
