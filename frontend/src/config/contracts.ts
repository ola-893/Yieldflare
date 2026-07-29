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
  parentVault: import.meta.env.VITE_PARENT_VAULT_ADDRESS || '0x01f64160E4928Eba5607aE294F9B66090Dc323B3',
  
  // FAssetAdapter - Direct minting integration
  fAssetAdapter: import.meta.env.VITE_FASSET_ADAPTER_ADDRESS || '0x4CE2d84CE6bc2Eb2e6923d032CDb10CcE9e418D6',
  
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

// ParentVault (ERC-4626) minimal ABI — object format for viem compatibility
export const PARENT_VAULT_ABI = [
  // ERC-4626 Standard
  {type:'function',name:'asset',stateMutability:'view',inputs:[],outputs:[{name:'',type:'address'}]},
  {type:'function',name:'totalAssets',stateMutability:'view',inputs:[],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'totalSupply',stateMutability:'view',inputs:[],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'balanceOf',stateMutability:'view',inputs:[{name:'account',type:'address'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'convertToShares',stateMutability:'view',inputs:[{name:'assets',type:'uint256'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'convertToAssets',stateMutability:'view',inputs:[{name:'shares',type:'uint256'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'maxDeposit',stateMutability:'view',inputs:[{name:'',type:'address'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'maxMint',stateMutability:'view',inputs:[{name:'',type:'address'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'maxWithdraw',stateMutability:'view',inputs:[{name:'owner',type:'address'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'maxRedeem',stateMutability:'view',inputs:[{name:'owner',type:'address'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'previewDeposit',stateMutability:'view',inputs:[{name:'assets',type:'uint256'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'previewMint',stateMutability:'view',inputs:[{name:'shares',type:'uint256'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'previewWithdraw',stateMutability:'view',inputs:[{name:'assets',type:'uint256'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'previewRedeem',stateMutability:'view',inputs:[{name:'shares',type:'uint256'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'deposit',stateMutability:'nonpayable',inputs:[{name:'assets',type:'uint256'},{name:'receiver',type:'address'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'mint',stateMutability:'nonpayable',inputs:[{name:'shares',type:'uint256'},{name:'receiver',type:'address'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'withdraw',stateMutability:'nonpayable',inputs:[{name:'assets',type:'uint256'},{name:'receiver',type:'address'},{name:'owner',type:'address'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'redeem',stateMutability:'nonpayable',inputs:[{name:'shares',type:'uint256'},{name:'receiver',type:'address'},{name:'owner',type:'address'}],outputs:[{name:'',type:'uint256'}]},
  // ERC-20 (shares)
  {type:'function',name:'name',stateMutability:'view',inputs:[],outputs:[{name:'',type:'string'}]},
  {type:'function',name:'symbol',stateMutability:'view',inputs:[],outputs:[{name:'',type:'string'}]},
  {type:'function',name:'decimals',stateMutability:'view',inputs:[],outputs:[{name:'',type:'uint8'}]},
  {type:'function',name:'approve',stateMutability:'nonpayable',inputs:[{name:'spender',type:'address'},{name:'amount',type:'uint256'}],outputs:[{name:'',type:'bool'}]},
  {type:'function',name:'allowance',stateMutability:'view',inputs:[{name:'owner',type:'address'},{name:'spender',type:'address'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'transfer',stateMutability:'nonpayable',inputs:[{name:'to',type:'address'},{name:'amount',type:'uint256'}],outputs:[{name:'',type:'bool'}]},
  {type:'function',name:'transferFrom',stateMutability:'nonpayable',inputs:[{name:'from',type:'address'},{name:'to',type:'address'},{name:'amount',type:'uint256'}],outputs:[{name:'',type:'bool'}]},
  // FlareYield specific
  {type:'function',name:'fAssetAdapter',stateMutability:'view',inputs:[],outputs:[{name:'',type:'address'}]},
  {type:'function',name:'totalPendingFAssetDeposits',stateMutability:'view',inputs:[],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'pendingFAssetDeposits',stateMutability:'view',inputs:[{name:'depositId',type:'bytes32'}],outputs:[{name:'receiver',type:'address'},{name:'queuedAt',type:'uint256'}]},
  // Events
  {type:'event',name:'Deposit',inputs:[{name:'sender',type:'address',indexed:true},{name:'owner',type:'address',indexed:true},{name:'assets',type:'uint256',indexed:false},{name:'shares',type:'uint256',indexed:false}]},
  {type:'event',name:'Withdraw',inputs:[{name:'sender',type:'address',indexed:true},{name:'receiver',type:'address',indexed:true},{name:'owner',type:'address',indexed:true},{name:'assets',type:'uint256',indexed:false},{name:'shares',type:'uint256',indexed:false}]},
  {type:'event',name:'FAssetDepositQueued',inputs:[{name:'depositId',type:'bytes32',indexed:true},{name:'receiver',type:'address',indexed:true}]},
  {type:'event',name:'FAssetDepositSettled',inputs:[{name:'depositId',type:'bytes32',indexed:true},{name:'receiver',type:'address',indexed:true},{name:'assets',type:'uint256',indexed:false},{name:'shares',type:'uint256',indexed:false}]},
] as const;

// FAssetAdapter minimal ABI — object format for viem compatibility
export const FASSET_ADAPTER_ABI = [
  {type:'function',name:'vault',stateMutability:'view',inputs:[],outputs:[{name:'',type:'address'}]},
  {type:'function',name:'fAsset',stateMutability:'view',inputs:[],outputs:[{name:'',type:'address'}]},
  {type:'function',name:'mintingTagManager',stateMutability:'view',inputs:[],outputs:[{name:'',type:'address'}]},
  {type:'function',name:'defaultDirectMintExecutor',stateMutability:'view',inputs:[],outputs:[{name:'',type:'address'}]},
  {type:'function',name:'registerMintingTag',stateMutability:'payable',inputs:[],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'tagUser',stateMutability:'view',inputs:[{name:'tag',type:'uint256'}],outputs:[{name:'',type:'address'}]},
  {type:'function',name:'tagExecutor',stateMutability:'view',inputs:[{name:'tag',type:'uint256'}],outputs:[{name:'',type:'address'}]},
  {type:'function',name:'processDirectMint',stateMutability:'nonpayable',inputs:[{name:'tag',type:'uint256'},{name:'depositId',type:'bytes32'},{name:'observedMintedAmount',type:'uint256'}],outputs:[]},
  {type:'function',name:'settleDirectMint',stateMutability:'nonpayable',inputs:[{name:'depositId',type:'bytes32'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'pendingDirectMints',stateMutability:'view',inputs:[{name:'depositId',type:'bytes32'}],outputs:[{name:'receiver',type:'address'},{name:'tag',type:'uint256'},{name:'assets',type:'uint256'}]},
  {type:'function',name:'setTagExecutor',stateMutability:'nonpayable',inputs:[{name:'tag',type:'uint256'},{name:'newExecutor',type:'address'}],outputs:[]},
  {type:'function',name:'pendingDepositForTag',stateMutability:'view',inputs:[{name:'tag',type:'uint256'}],outputs:[{name:'',type:'bytes32'}]},
  // Events
  {type:'event',name:'MintingTagRegistered',inputs:[{name:'tag',type:'uint256',indexed:true},{name:'user',type:'address',indexed:true},{name:'executor',type:'address',indexed:true}]},
  {type:'event',name:'DirectMintProcessed',inputs:[{name:'depositId',type:'bytes32',indexed:true},{name:'tag',type:'uint256',indexed:true},{name:'receiver',type:'address',indexed:true},{name:'postFeeAssets',type:'uint256',indexed:false}]},
  {type:'event',name:'DirectMintSettled',inputs:[{name:'depositId',type:'bytes32',indexed:true},{name:'receiver',type:'address',indexed:true},{name:'assets',type:'uint256',indexed:false},{name:'shares',type:'uint256',indexed:false}]},
] as const;

// FXRP (ERC-20) minimal ABI — object format for viem compatibility
export const FXRP_ABI = [
  {type:'function',name:'name',stateMutability:'view',inputs:[],outputs:[{name:'',type:'string'}]},
  {type:'function',name:'symbol',stateMutability:'view',inputs:[],outputs:[{name:'',type:'string'}]},
  {type:'function',name:'decimals',stateMutability:'view',inputs:[],outputs:[{name:'',type:'uint8'}]},
  {type:'function',name:'totalSupply',stateMutability:'view',inputs:[],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'balanceOf',stateMutability:'view',inputs:[{name:'account',type:'address'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'transfer',stateMutability:'nonpayable',inputs:[{name:'to',type:'address'},{name:'amount',type:'uint256'}],outputs:[{name:'',type:'bool'}]},
  {type:'function',name:'allowance',stateMutability:'view',inputs:[{name:'owner',type:'address'},{name:'spender',type:'address'}],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'approve',stateMutability:'nonpayable',inputs:[{name:'spender',type:'address'},{name:'amount',type:'uint256'}],outputs:[{name:'',type:'bool'}]},
  {type:'function',name:'transferFrom',stateMutability:'nonpayable',inputs:[{name:'from',type:'address'},{name:'to',type:'address'},{name:'amount',type:'uint256'}],outputs:[{name:'',type:'bool'}]},
  // Events
  {type:'event',name:'Transfer',inputs:[{name:'from',type:'address',indexed:true},{name:'to',type:'address',indexed:true},{name:'value',type:'uint256',indexed:false}]},
  {type:'event',name:'Approval',inputs:[{name:'owner',type:'address',indexed:true},{name:'spender',type:'address',indexed:true},{name:'value',type:'uint256',indexed:false}]},
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

// MintingTagManager minimal ABI — object format for viem compatibility
export const MINTING_TAG_MANAGER_ABI = [
  {type:'function',name:'reservationFee',stateMutability:'view',inputs:[],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'nextAvailableTag',stateMutability:'view',inputs:[],outputs:[{name:'',type:'uint256'}]},
  {type:'function',name:'mintingRecipient',stateMutability:'view',inputs:[{name:'tag',type:'uint256'}],outputs:[{name:'',type:'address'}]},
  {type:'function',name:'allowedExecutor',stateMutability:'view',inputs:[{name:'tag',type:'uint256'}],outputs:[{name:'',type:'address'}]},
  {type:'function',name:'reservedTagsForOwner',stateMutability:'view',inputs:[{name:'owner',type:'address'}],outputs:[{name:'',type:'uint256[]'}]},
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
