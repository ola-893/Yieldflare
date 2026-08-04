// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IRewardManager
 * @notice Interface for claiming FTSO v2 delegation rewards
 */
interface IRewardManager {
    struct RewardClaimWithProof {
        bytes32[] merkleProof;
        RewardClaim body;
    }

    struct RewardClaim {
        uint24 rewardEpochId;
        bytes20 beneficiary;
        uint120 amount;
        uint8 claimType;
    }

    /**
     * @notice Claim rewards for specific reward epochs
     * @param _recipient Address to receive the rewards
     * @param _rewardEpochId Reward epoch to claim from
     * @param _rewardOwner Address that earned the rewards
     * @param _rewardClaims Array of reward claims with merkle proofs
     * @return _rewardAmount Total amount of rewards claimed
     */
    function claim(
        address payable _recipient,
        uint24 _rewardEpochId,
        address _rewardOwner,
        RewardClaimWithProof[] calldata _rewardClaims
    ) external returns (uint256 _rewardAmount);

    /**
     * @notice Automatically claim all available rewards
     * @param _recipient Address to receive the rewards
     * @param _rewardEpochs Array of reward epoch IDs to claim
     * @return _rewardAmount Total amount of rewards claimed
     */
    function autoClaim(
        address payable _recipient,
        uint24[] calldata _rewardEpochs
    ) external returns (uint256 _rewardAmount);

    /**
     * @notice Get claimable amount for an address at a specific epoch
     */
    function getClaimableAmount(
        uint24 _rewardEpochId,
        address _beneficiary
    ) external view returns (uint256);

    /**
     * @notice Get the current reward epoch ID
     */
    function getCurrentRewardEpochId() external view returns (uint24);

    /**
     * @notice Get the first claimable reward epoch
     */
    function getInitialRewardEpochId() external view returns (uint256);

    /**
     * @notice Check if rewards are claimable for a specific epoch
     */
    function isRewardClaimable(uint24 _rewardEpochId) external view returns (bool);
}
