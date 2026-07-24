/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Network
  readonly VITE_CHAIN_ID: string
  readonly VITE_NETWORK_NAME: string
  readonly VITE_RPC_URL: string
  
  // Core Protocol Contracts
  readonly VITE_PARENT_VAULT_ADDRESS: string
  readonly VITE_FASSET_ADAPTER_ADDRESS: string
  
  // Token Addresses
  readonly VITE_FXRP_ADDRESS: string
  
  // FAsset Infrastructure
  readonly VITE_ASSET_MANAGER_FXRP_ADDRESS: string
  readonly VITE_MINTING_TAG_MANAGER_ADDRESS: string
  
  // Explorer
  readonly VITE_EXPLORER_URL: string
  
  // Deployer Info
  readonly VITE_DEPLOYER_ADDRESS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
