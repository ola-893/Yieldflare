/**
 * StrategyChart – Visual breakdown of TVL across Kinetic and Enosys strategies.
 */

interface StrategyData {
  name: string;
  protocol: string;
  icon: string;
  colorClass: string;
  tvl: number;
  apy: number;
  allocation: number; // percentage 0-100
  yieldEarned: number;
  status: 'active' | 'idle';
}

const strategies: StrategyData[] = [
  {
    name: 'Kinetic Lending',
    protocol: 'Compound V2 Fork',
    icon: 'K',
    colorClass: 'kinetic',
    tvl: 847_500,
    apy: 6.8,
    allocation: 62,
    yieldEarned: 12_450,
    status: 'active',
  },
  {
    name: 'Enosys DEX',
    protocol: 'Uniswap V3 Fork',
    icon: 'E',
    colorClass: 'enosys',
    tvl: 518_200,
    apy: 11.2,
    allocation: 38,
    yieldEarned: 8_920,
    status: 'active',
  },
];

function formatUSD(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export default function StrategyChart() {
  return (
    <div className="strategy-grid">
      {strategies.map((s) => (
        <div className="strategy-card" key={s.name}>
          <div className="strategy-card-header">
            <div className={`strategy-icon ${s.colorClass}`}>{s.icon}</div>
            <div>
              <div className="strategy-name">{s.name}</div>
              <div className="strategy-protocol">{s.protocol}</div>
            </div>
            <span className={`badge ${s.status === 'active' ? 'live' : 'pending'}`} style={{ marginLeft: 'auto' }}>
              {s.status === 'active' && <span className="pulse-dot" />}
              {s.status}
            </span>
          </div>

          <div className="strategy-bar">
            <div
              className={`strategy-bar-fill ${s.colorClass}`}
              style={{ width: `${s.allocation}%` }}
            />
          </div>

          <div className="strategy-stat-row">
            <span className="strategy-stat-label">TVL Deployed</span>
            <span className="strategy-stat-value">{formatUSD(s.tvl)}</span>
          </div>
          <div className="strategy-stat-row">
            <span className="strategy-stat-label">Current APY</span>
            <span className="strategy-stat-value" style={{ color: 'var(--color-yield)' }}>
              {s.apy.toFixed(1)}%
            </span>
          </div>
          <div className="strategy-stat-row">
            <span className="strategy-stat-label">Allocation</span>
            <span className="strategy-stat-value">{s.allocation}%</span>
          </div>
          <div className="strategy-stat-row">
            <span className="strategy-stat-label">Yield Earned</span>
            <span className="strategy-stat-value" style={{ color: 'var(--color-yield)' }}>
              {formatUSD(s.yieldEarned)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
