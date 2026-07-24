import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/* ─── XRP Deposit State Machine ─────────────────────────────────────────── */
/* States mirror the architecture doc's stateDiagram-v2 */
export type XrpDepositState =
  | 'disconnected'
  | 'connected'
  | 'entering_amount'
  | 'requesting_tag'
  | 'waiting_for_signature'
  | 'broadcasting_xrp'
  | 'fdc_proving'
  | 'minting_fassets'
  | 'complete';

interface XrpWalletContextValue {
  /** Current state of the XRP deposit flow */
  state: XrpDepositState;
  /** Simulated XRP address */
  xrpAddress: string | null;
  /** Simulated destination tag for the current deposit */
  destinationTag: string | null;
  /** Deposit amount in XRP */
  depositAmount: string;
  /** Connect the simulated XRP wallet */
  connect: () => void;
  /** Disconnect */
  disconnect: () => void;
  /** Start a new deposit flow */
  startDeposit: () => void;
  /** Set the deposit amount */
  setDepositAmount: (amount: string) => void;
  /** Advance the deposit state machine by one step */
  advanceStep: () => void;
  /** Reset to connected state */
  resetFlow: () => void;
}

const XrpWalletContext = createContext<XrpWalletContextValue | null>(null);

const STEP_DELAYS: Partial<Record<XrpDepositState, number>> = {
  requesting_tag: 1500,
  waiting_for_signature: 2000,
  broadcasting_xrp: 2500,
  fdc_proving: 4000,
  minting_fassets: 2000,
};

const NEXT_STATE: Partial<Record<XrpDepositState, XrpDepositState>> = {
  entering_amount: 'requesting_tag',
  requesting_tag: 'waiting_for_signature',
  waiting_for_signature: 'broadcasting_xrp',
  broadcasting_xrp: 'fdc_proving',
  fdc_proving: 'minting_fassets',
  minting_fassets: 'complete',
};

const MOCK_XRP_ADDRESS = 'rN7n3473SaZBCG4dFL83w7p1W9cgPJKpao';

export function XrpWalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<XrpDepositState>('disconnected');
  const [xrpAddress, setXrpAddress] = useState<string | null>(null);
  const [destinationTag, setDestinationTag] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');

  const connect = useCallback(() => {
    setXrpAddress(MOCK_XRP_ADDRESS);
    setState('connected');
  }, []);

  const disconnect = useCallback(() => {
    setXrpAddress(null);
    setDestinationTag(null);
    setDepositAmount('');
    setState('disconnected');
  }, []);

  const startDeposit = useCallback(() => {
    setState('entering_amount');
  }, []);

  const advanceStep = useCallback(() => {
    setState((current) => {
      const next = NEXT_STATE[current];
      if (!next) return current;

      // Auto-advance through simulated steps with delays
      const delay = STEP_DELAYS[next];
      if (delay && next !== 'complete') {
        const afterNext = NEXT_STATE[next];
        if (afterNext) {
          setTimeout(() => {
            setState(afterNext);
            // Continue auto-advancing for subsequent automated steps
            const nextDelay = STEP_DELAYS[afterNext];
            if (nextDelay && afterNext !== 'complete') {
              const afterAfterNext = NEXT_STATE[afterNext];
              if (afterAfterNext) {
                setTimeout(() => setState(afterAfterNext), nextDelay);
                // And one more level for minting
                if (STEP_DELAYS[afterAfterNext]) {
                  const finalNext = NEXT_STATE[afterAfterNext];
                  if (finalNext) {
                    setTimeout(() => setState(finalNext), nextDelay + (STEP_DELAYS[afterAfterNext] || 0));
                  }
                }
              }
            }
          }, delay);
        }
      }

      if (next === 'requesting_tag') {
        setDestinationTag(String(Math.floor(100000 + Math.random() * 900000)));
      }

      return next;
    });
  }, []);

  const resetFlow = useCallback(() => {
    setDestinationTag(null);
    setDepositAmount('');
    setState('connected');
  }, []);

  return (
    <XrpWalletContext.Provider
      value={{
        state,
        xrpAddress,
        destinationTag,
        depositAmount,
        connect,
        disconnect,
        startDeposit,
        setDepositAmount,
        advanceStep,
        resetFlow,
      }}
    >
      {children}
    </XrpWalletContext.Provider>
  );
}

export function useXrpWallet() {
  const ctx = useContext(XrpWalletContext);
  if (!ctx) throw new Error('useXrpWallet must be used within XrpWalletProvider');
  return ctx;
}
