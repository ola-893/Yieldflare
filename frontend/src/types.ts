/**
 * Flux Protocol TypeScript Definitions
 */

export interface VaultInfo {
  id: string;
  name: string;
  assetSymbol: 'FXRP' | 'USDC.e';
  strategyType: 'Kinetic Lending' | 'Enosys DEX LP' | 'FTSO Delegation' | 'SparkDEX LP' | 'Direct Mint' | 'Enosys DEX FXRP';
  projectedApy: string;
  status: 'Testnet' | 'Mainnet' | 'Deployed' | 'Coming Soon';
  primaryProtocol: string;
  primaryProtocolUrl: string;
  contractAddress?: string;
  description: string;
  details: string[];
}

export interface ArchitectureComponent {
  id: string;
  title: string;
  subtitle: string;
  realSystemName: string;
  description: string;
  xRatio: number; // 0 to 1 relative to canvas width
  yRatio: number; // 0 to 1 relative to canvas height
  minScroll: number; // scroll threshold to show
  maxScroll: number;
  tag: string;
  technicalDetails: string[];
}

export interface ScrollBreakpoint {
  progress: number;
  label: string;
  stateDescription: string;
}

export interface DepositSimulation {
  asset: 'XRP' | 'BTC';
  amount: number;
  durationMonths: number;
  projectedApy: number;
  monthlyYieldUsd: number;
  totalProjectedValueUsd: number;
}

export interface TEEAuditProof {
  enclaveId: string;
  attestationStatus: 'Verified' | 'Signing' | 'Secured';
  lastRebalanceTime: string;
  strategyHash: string;
  mevProtectionEnabled: boolean;
}

export interface UserDesignPreviewOption {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  svgContent: string;
  description: string;
}
