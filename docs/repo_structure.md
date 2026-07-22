# Repository Structure

This document outlines the strict folder structure and separation of concerns for the Flare-Native Yield Manager GitHub repository.

## Root Directory

The project follows a monorepo structure, strictly isolating the Foundry smart contracts from the React frontend application to ensure clean build pipelines and dependency management.

```text
flare_yield_manager/
├── docs/                      # 📚 The absolute source of truth for platform design
│   ├── architecture.md        # Comprehensive system blueprints
│   ├── platform_overview.md   # Visual Mermaid diagrams of the system
│   ├── frontend_architecture.md # React structure and state mechanics
│   └── repo_structure.md      # This file
│
├── contracts/                 # ⛓️ Foundry Workspace (Solidity)
│   ├── src/
│   │   ├── interfaces/        # IParentVault, IStrategyAdapter, IFAssetAdapter
│   │   ├── core/              # ParentVault.sol, YieldToken.sol
│   │   ├── adapters/          # AaveAdapter.sol, KineticAdapter.sol, FAssetAdapter.sol
│   │   └── libraries/         # Math, Security, MEV helpers
│   ├── test/                  # Foundry Unit & Integration Tests
│   ├── script/                # Deployment Scripts
│   ├── foundry.toml           # Foundry configuration
│   └── remappings.txt         # OpenZeppelin & Flare dependency mappings
│
├── frontend/                  # 💻 React (Vite) Workspace
│   ├── src/
│   │   ├── components/        # Reusable UI components (Buttons, Modals)
│   │   ├── hooks/             # Custom wagmi/viem hooks (useDeposit, useYield)
│   │   ├── pages/             # Route views (Dashboard, Documentation)
│   │   ├── config/            # Chain configs, WalletConnect project IDs
│   │   └── content/           # Markdown parser for in-app documentation rendering
│   ├── public/                # Static assets (Logos, Icons)
│   ├── index.html             # Vite entry point
│   ├── tailwind.config.js     # Shadcn & UI styling tokens
│   └── package.json           # Node dependencies
│
└── .github/                   # ⚙️ CI/CD Pipelines
    └── workflows/
        ├── forge-test.yml     # Automated smart contract testing
        └── frontend-build.yml # React build verification
```

## Dependency Management

- **Backend (Contracts)**: Relies exclusively on `forge` and git submodules (e.g., OpenZeppelin) to avoid mixing NPM node_modules into the Solidity environment.
- **Frontend**: Relies on `npm` or `pnpm` exclusively inside the `/frontend` directory.

## Documentation Parsing
The React frontend is responsible for fetching files from the `docs/` folder (at the root) during the build process, rendering them via `react-markdown` and `mermaid-js` into the "In-App Developer Docs" page. This ensures that the GitHub docs and the User-facing docs are always 100% perfectly synchronized.
