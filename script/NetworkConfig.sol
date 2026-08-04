// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title NetworkConfig
 * @notice Network-specific configuration for Coston2 testnet and Flare mainnet deployments.
 * @dev Keyed on block.chainid to prevent cross-network configuration bleeding.
 */
library NetworkConfig {
    struct Config {
        string name;
        address flareContractRegistry;
        bool hasKineticDeployment;
        bool hasEnosysDeployment;
        address kineticComptroller;
        address kineticKFXRP;
        address enosysRouter;
        address enosysPoolFXRPWFLR;
        address wflr;
    }

    /// @notice Coston2 testnet chain ID
    uint256 constant COSTON2_CHAIN_ID = 114;

    /// @notice Flare mainnet chain ID
    uint256 constant FLARE_CHAIN_ID = 14;

    /// @notice Get network configuration based on current chain ID
    function get() internal view returns (Config memory) {
        if (block.chainid == COSTON2_CHAIN_ID) {
            return getCoston2Config();
        } else if (block.chainid == FLARE_CHAIN_ID) {
            return getFlareConfig();
        } else {
            revert("Unsupported network");
        }
    }

    /// @notice Coston2 testnet configuration
    function getCoston2Config() internal pure returns (Config memory) {
        return Config({
            name: "Coston2",
            flareContractRegistry: 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019,
            hasKineticDeployment: false, // Kinetic is mainnet-only
            hasEnosysDeployment: true, // Enosys V3 deployed on Coston2!
            kineticComptroller: address(0),
            kineticKFXRP: address(0),
            enosysRouter: 0xD2fD55647A90fD1f2D071e115Bb713B3C145D5e2, // Enosys V3 Position Manager / Router
            enosysPoolFXRPWFLR: 0x81e7628F5add2286E798B6b77B4C5ace4C62A40E, // Enosys V3 Active Pool
            wflr: 0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273 // WC2FLR / WFLR on Coston2
        });
    }

    /// @notice Flare mainnet configuration
    function getFlareConfig() internal pure returns (Config memory) {
        return Config({
            name: "Flare",
            flareContractRegistry: 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019,
            hasKineticDeployment: true,
            hasEnosysDeployment: true,
            // TODO: Look up these mainnet addresses before deploying
            kineticComptroller: 0x15F69897E6aEBE0463401345543C26d1Fd994abB, // Kinetic Unitroller
            kineticKFXRP: address(0), // TODO: Find kFXRP market address
            enosysRouter: address(0), // TODO: Find Enosys V3 SwapRouter
            enosysPoolFXRPWFLR: address(0), // TODO: Find FXRP/WFLR pool address
            wflr: 0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d // Wrapped Flare (confirmed)
        });
    }
}
