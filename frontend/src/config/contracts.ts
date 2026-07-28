/**
 * FlareYield Smart Contract Addresses
 * 
 * Loaded from environment variables (.env file)
 * Deployed on Flare Coston2 Testnet
 * Chain ID: 114
 */

export const COSTON2_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID) || 114;

/**
 * Core FlareYield Protocol Contracts
 */
export const CONTRACTS = {
  // ParentVault - ERC-4626 vault (proxy)
  parentVault: import.meta.env.VITE_PARENT_VAULT_ADDRESS || '0xdD227AC6660510985FE035A01e2cE7bbE75C78d4',
  
  // FAssetAdapter - Direct minting integration
  fAssetAdapter: import.meta.env.VITE_FASSET_ADAPTER_ADDRESS || '0x38e37aff09a57efEfa62cE19AdEEef3bfc008369',
  
  // FXRP Token (Flare-wrapped XRP)
  fxrp: import.meta.env.VITE_FXRP_ADDRESS || '0x0b6A3645c240605887a5532109323A3E12273dc7',
  
  // Flare FAsset Infrastructure
  assetManagerFXRP: import.meta.env.VITE_ASSET_MANAGER_FXRP_ADDRESS || '0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA',
  mintingTagManager: import.meta.env.VITE_MINTING_TAG_MANAGER_ADDRESS || '0x094511737909b626391106bBc21B25feb2D67B96',
} as const;

/**
 * Contract ABIs
 * Import from generated files or define minimal ABIs here
 */

// ParentVault (ERC-4626) minimal ABI
export const PARENT_VAULT_ABI = [
  // ERC-4626 Standard
  'function asset() external view returns (address)',
  'function totalAssets() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function convertToShares(uint256 assets) external view returns (uint256)',
  'function convertToAssets(uint256 shares) external view returns (uint256)',
  'function maxDeposit(address) external view returns (uint256)',
  'function maxMint(address) external view returns (uint256)',
  'function maxWithdraw(address owner) external view returns (uint256)',
  'function maxRedeem(address owner) external view returns (uint256)',
  'function previewDeposit(uint256 assets) external view returns (uint256)',
  'function previewMint(uint256 shares) external view returns (uint256)',
  'function previewWithdraw(uint256 assets) external view returns (uint256)',
  'function previewRedeem(uint256 shares) external view returns (uint256)',
  'function deposit(uint256 assets, address receiver) external returns (uint256)',
  'function mint(uint256 shares, address receiver) external returns (uint256)',
  'function withdraw(uint256 assets, address receiver, address owner) external returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) external returns (uint256)',
  
  // ERC-20 (shares)
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  
  // FlareYield specific
  'function fAssetAdapter() external view returns (address)',
  'function totalPendingFAssetDeposits() external view returns (uint256)',
  'function pendingFAssetDeposits(bytes32 depositId) external view returns (address receiver, uint256 queuedAt)',
  
  // Events
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
  'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
  'event FAssetDepositQueued(bytes32 indexed depositId, address indexed receiver)',
  'event FAssetDepositSettled(bytes32 indexed depositId, address indexed receiver, uint256 assets, uint256 shares)',
] as const;

// FAssetAdapter minimal ABI
export const FASSET_ADAPTER_ABI = [
  'function vault() external view returns (address)',
  'function fAsset() external view returns (address)',
  'function mintingTagManager() external view returns (address)',
  'function defaultDirectMintExecutor() external view returns (address)',
  'function registerMintingTag() external payable returns (uint256)',
  'function tagUser(uint256 tag) external view returns (address)',
  'function tagExecutor(uint256 tag) external view returns (address)',
  'function processDirectMint(uint256 tag, bytes32 depositId, uint256 observedMintedAmount) external',
  'function settleDirectMint(bytes32 depositId) external returns (uint256)',
  'function pendingDirectMints(bytes32 depositId) external view returns (address receiver, uint256 tag, uint256 assets)',
  'function setTagExecutor(uint256 tag, address newExecutor) external',
  
  // Events
  'event MintingTagRegistered(uint256 indexed tag, address indexed user, address indexed executor)',
  'event DirectMintProcessed(bytes32 indexed depositId, uint256 indexed tag, address indexed receiver, uint256 postFeeAssets)',
  'event DirectMintSettled(bytes32 indexed depositId, address indexed receiver, uint256 assets, uint256 shares)',
] as const;

// FXRP (ERC-20) minimal ABI
export const FXRP_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  
  // Events
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
] as const;

// AssetManager ABI (for fetching Core Vault XRPL address)
export const ASSET_MANAGER_ABI = [
  {
    name: 'directMintingPaymentAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{name: '', type: 'string'}],
  },
] as const;

// MintingTagManager minimal ABI
export const MINTING_TAG_MANAGER_ABI = [
  'function reservationFee() external view returns (uint256)',
  'function nextAvailableTag() external view returns (uint256)',
  'function mintingRecipient(uint256 tag) external view returns (address)',
  'function allowedExecutor(uint256 tag) external view returns (address)',
  'function reservedTagsForOwner(address owner) external view returns (uint256[])',
] as const;

/**
 * Explorer URLs
 */
export const EXPLORER_BASE_URL = import.meta.env.VITE_EXPLORER_URL || 'https://coston2-explorer.flare.network';

export const getExplorerUrl = (address: string, type: 'address' | 'tx' = 'address') => {
  return `${EXPLORER_BASE_URL}/${type}/${address}`;
};

/**
 * Helper to check if connected to correct network
 */
export const isCoston2 = (chainId: number | undefined) => {
  return chainId === COSTON2_CHAIN_ID;
};

/**
 * Human-readable contract names
 */
export const CONTRACT_NAMES = {
  [CONTRACTS.parentVault]: 'FlareYield Vault',
  [CONTRACTS.fAssetAdapter]: 'FAsset Adapter',
  [CONTRACTS.fxrp]: 'FXRP Token',
  [CONTRACTS.assetManagerFXRP]: 'Asset Manager FXRP',
  [CONTRACTS.mintingTagManager]: 'Minting Tag Manager',
} as const;
