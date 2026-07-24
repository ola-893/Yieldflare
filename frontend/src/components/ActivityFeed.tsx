/**
 * ActivityFeed – Live feed of recent rebalances, deposits, and harvests.
 */

interface Activity {
  id: string;
  type: 'rebalance' | 'deposit' | 'harvest' | 'emergency';
  title: string;
  description: string;
  value: string;
  timestamp: string;
}

const MOCK_ACTIVITIES: Activity[] = [
  {
    id: '1',
    type: 'rebalance',
    title: 'Strategy Rebalance Executed',
    description: 'TEE moved 38% allocation from Kinetic → Enosys FXRP/WFLR',
    value: '$518.2K',
    timestamp: '12 min ago',
  },
  {
    id: '2',
    type: 'deposit',
    title: 'Direct Mint Settled',
    description: 'Tag #482917 — 2,500 FXRP minted via FAsset bridge',
    value: '2,375 FYD',
    timestamp: '34 min ago',
  },
  {
    id: '3',
    type: 'harvest',
    title: 'JOULE Rewards Harvested',
    description: 'Kinetic adapter claimed 450 JOULE → DAO treasury',
    value: '$1,240',
    timestamp: '2 hr ago',
  },
  {
    id: '4',
    type: 'rebalance',
    title: 'TWAP Window Validated',
    description: 'FCC signed 24h TWAPY: Kinetic 6.8%, Enosys 11.2%',
    value: '',
    timestamp: '2 hr ago',
  },
  {
    id: '5',
    type: 'deposit',
    title: 'ERC-4626 Deposit',
    description: '0x7a3f...8c21 deposited 15,000 FXRP directly on Flare',
    value: '14,250 FYD',
    timestamp: '5 hr ago',
  },
  {
    id: '6',
    type: 'harvest',
    title: 'Enosys Swap Fees Collected',
    description: 'LP position earned 0.3% fees on FXRP/WFLR volume',
    value: '$820',
    timestamp: '8 hr ago',
  },
  {
    id: '7',
    type: 'rebalance',
    title: 'Slippage Guard Triggered',
    description: 'Sandwich attempt blocked — minAmountOut enforced by TEE',
    value: 'Saved $3.2K',
    timestamp: '1 day ago',
  },
];

export default function ActivityFeed() {
  return (
    <div className="glass-card">
      <div className="glass-card-header">
        <span className="glass-card-title">Recent Activity</span>
        <span className="badge tee">
          <span className="pulse-dot" style={{ background: '#818cf8' }} />
          TEE Active
        </span>
      </div>

      {MOCK_ACTIVITIES.map((activity) => (
        <div key={activity.id} className="activity-item">
          <div className={`activity-dot ${activity.type}`} />
          <div className="activity-content">
            <div className="activity-title">{activity.title}</div>
            <div className="activity-meta">{activity.description}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {activity.value && <div className="activity-value">{activity.value}</div>}
            <div className="activity-meta">{activity.timestamp}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
