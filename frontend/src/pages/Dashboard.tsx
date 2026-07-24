import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useXrpWallet } from '../contexts/XrpWalletContext';
import DepositModal from '../components/DepositModal';
import StrategyChart from '../components/StrategyChart';
import ActivityFeed from '../components/ActivityFeed';

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const { state: xrpState, connect: connectXrp } = useXrpWallet();
  const [showDeposit, setShowDeposit] = useState(false);

  const handleDeposit = () => {
    if (xrpState === 'disconnected') {
      connectXrp();
    }
    setShowDeposit(true);
  };

  return (
    <>
      {/* Stats Row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Value Locked</div>
          <div className="stat-value gradient">$1.36M</div>
          <div className="stat-delta positive">↑ 12.4% this week</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Blended APY</div>
          <div className="stat-value yield">8.4%</div>
          <div className="stat-delta positive">↑ 0.6% vs last epoch</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Your FlareYield Balance</div>
          <div className="stat-value" style={{ color: 'var(--color-text-primary)' }}>
            {isConnected ? '4,250.00 FYD' : '—'}
          </div>
          <div className="stat-delta" style={{ color: 'var(--color-text-muted)' }}>
            {isConnected
              ? `${address?.slice(0, 6)}...${address?.slice(-4)}`
              : 'Connect wallet to view'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">TEE Uptime</div>
          <div className="stat-value" style={{ color: '#818cf8' }}>99.8%</div>
          <div className="stat-delta" style={{ color: 'var(--color-text-muted)' }}>
            Last rebalance: 12m ago
          </div>
        </div>
      </div>

      {/* Deposit CTA */}
      <div
        className="glass-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-2xl)',
          background: 'linear-gradient(135deg, rgba(230,51,95,0.08), rgba(255,107,74,0.05), rgba(245,158,11,0.03))',
          borderColor: 'rgba(230, 51, 95, 0.15)',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 4 }}>
            Deposit XRP & Earn Yield Instantly
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem' }}>
            Bridge native XRP into FlareYield via Flare's 1-click FAsset Direct Minting — no manual bridging required.
          </p>
        </div>
        <button id="open-deposit-btn" className="btn btn-primary btn-lg" onClick={handleDeposit}>
          Deposit XRP
        </button>
      </div>

      {/* Strategy Breakdown */}
      <div className="glass-card-header" style={{ marginBottom: 'var(--space-md)' }}>
        <span className="glass-card-title">Strategy Allocation</span>
        <span className="badge live">
          <span className="pulse-dot" />
          Live
        </span>
      </div>
      <StrategyChart />

      {/* Activity Feed */}
      <ActivityFeed />

      {/* Deposit Modal */}
      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
    </>
  );
}
