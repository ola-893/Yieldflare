import { useState } from 'react';
import { useXrpWallet, type XrpDepositState } from '../contexts/XrpWalletContext';

const STEP_LABELS: { key: XrpDepositState; label: string }[] = [
  { key: 'entering_amount', label: 'Amount' },
  { key: 'requesting_tag', label: 'Tag' },
  { key: 'waiting_for_signature', label: 'Sign' },
  { key: 'broadcasting_xrp', label: 'Broadcast' },
  { key: 'fdc_proving', label: 'FDC Proof' },
  { key: 'minting_fassets', label: 'Mint' },
  { key: 'complete', label: 'Done' },
];

const STEP_ORDER: XrpDepositState[] = STEP_LABELS.map((s) => s.key);

function getStepStatus(current: XrpDepositState, step: XrpDepositState): 'completed' | 'active' | 'pending' {
  const ci = STEP_ORDER.indexOf(current);
  const si = STEP_ORDER.indexOf(step);
  if (si < ci) return 'completed';
  if (si === ci) return 'active';
  return 'pending';
}

interface Props {
  onClose: () => void;
}

export default function DepositModal({ onClose }: Props) {
  const { state, destinationTag, depositAmount, setDepositAmount, advanceStep, resetFlow } = useXrpWallet();
  const [inputValue, setInputValue] = useState(depositAmount || '');

  const handleSubmitAmount = () => {
    if (!inputValue || parseFloat(inputValue) <= 0) return;
    setDepositAmount(inputValue);
    advanceStep(); // entering_amount → requesting_tag
  };

  const handleSignTransaction = () => {
    advanceStep(); // requesting_tag → waiting_for_signature → ... auto-advances
  };

  const handleDone = () => {
    resetFlow();
    onClose();
  };

  const isAutoStep = ['waiting_for_signature', 'broadcasting_xrp', 'fdc_proving', 'minting_fassets'].includes(state);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <h2 className="modal-title">Deposit XRP</h2>
        <p className="modal-subtitle">
          Bridge native XRP into FlareYield via Flare's FAsset Direct Minting
        </p>

        {/* Step indicator */}
        <div className="deposit-steps">
          {STEP_LABELS.map(({ key, label }) => {
            const status = getStepStatus(state, key);
            return (
              <div key={key} className={`deposit-step ${status}`}>
                <div className="deposit-step-dot">
                  {status === 'completed' ? '✓' : STEP_ORDER.indexOf(key) + 1}
                </div>
                <div className="deposit-step-label">{label}</div>
              </div>
            );
          })}
        </div>

        {/* Step content */}
        {state === 'entering_amount' && (
          <div>
            <div className="input-group">
              <label className="input-label">Deposit Amount</label>
              <input
                id="deposit-amount-input"
                className="input-field"
                type="number"
                placeholder="0.00"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                min="0"
                step="0.01"
                autoFocus
              />
              <div className="input-suffix">XRP · ~${(parseFloat(inputValue || '0') * 2.15).toFixed(2)} USD</div>
            </div>
            <button
              id="submit-deposit-btn"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={handleSubmitAmount}
              disabled={!inputValue || parseFloat(inputValue) <= 0}
            >
              Continue
            </button>
          </div>
        )}

        {state === 'requesting_tag' && (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto var(--space-lg)' }} />
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
              Registering your minting tag on Flare...
            </p>
            {destinationTag && (
              <div style={{ marginTop: 'var(--space-lg)' }}>
                <div className="input-label">Your Destination Tag</div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.8rem',
                  fontWeight: 700,
                  background: 'var(--gradient-accent)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  {destinationTag}
                </div>
                <button
                  id="sign-xrp-tx-btn"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%', marginTop: 'var(--space-lg)' }}
                  onClick={handleSignTransaction}
                >
                  Sign XRP Transaction
                </button>
              </div>
            )}
          </div>
        )}

        {isAutoStep && (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto var(--space-lg)' }} />
            <p style={{ color: 'var(--color-text-primary)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
              {state === 'waiting_for_signature' && 'Waiting for Xumm signature...'}
              {state === 'broadcasting_xrp' && 'Broadcasting to XRP Ledger...'}
              {state === 'fdc_proving' && 'FDC generating state proof...'}
              {state === 'minting_fassets' && 'Minting FXRP & FlareYield shares...'}
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
              {state === 'fdc_proving' && 'This may take 1–3 minutes on mainnet'}
              {state === 'minting_fassets' && 'Almost there — confirming on Flare'}
            </p>
          </div>
        )}

        {state === 'complete' && (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(52, 211, 153, 0.15)', color: 'var(--color-yield)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', margin: '0 auto var(--space-lg)',
            }}>✓</div>
            <p style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 'var(--space-sm)' }}>
              Deposit Complete!
            </p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: 'var(--space-lg)' }}>
              {depositAmount} XRP → {(parseFloat(depositAmount) * 0.95).toFixed(2)} FXRP minted (5% executor fee)
            </p>
            <div style={{
              background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)',
              padding: 'var(--space-md) var(--space-lg)', marginBottom: 'var(--space-lg)',
              fontFamily: 'var(--font-mono)', fontSize: '0.85rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>FlareYield Shares</span>
                <span style={{ fontWeight: 600 }}>{(parseFloat(depositAmount) * 0.95).toFixed(2)} FYD</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Est. APY</span>
                <span style={{ fontWeight: 600, color: 'var(--color-yield)' }}>8.4%</span>
              </div>
            </div>
            <button
              id="close-deposit-btn"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={handleDone}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
