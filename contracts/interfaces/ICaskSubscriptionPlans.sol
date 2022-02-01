// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICaskSubscriptionPlans {

    enum PlanStatus {
        Enabled,
        Disabled,
        EndOfLife
    }

    struct Discount {
        uint256 value;
        uint32 validAfter;
        uint32 expiresAt;
        uint32 maxUses;
        uint32 planId;
        bool isFixed;
    }

    struct Provider {
        address paymentAddress;
        bytes32 discountMerkleRoot;
        string cid;
    }

    function setProviderProfile(address _paymentAddress, string calldata _cid) external;

    function getProviderProfile(address _provider) external view returns(Provider memory);

    function consumeDiscount(address _provider, uint32 _planId,
        bytes32 _discountId, bytes32 _discountData) external returns(bool);

    function getPlanStatus(address _provider, uint32 _planId) external view returns (PlanStatus);

    function getPlanEOL(address _provider, uint32 _planId) external view returns (uint32);

    function disablePlan(uint32 _planId) external;

    function enablePlan(uint32 _planId) external;

    function killPlan(uint32 _planId, uint32 _eolAt) external;

    function verifyPlan(bytes32 _planData, bytes32 _merkleRoot,
        bytes32[] calldata _merkleProof) external view returns(bool);

    function verifyDiscount(address _provider, uint32 _planId, bytes32 _discountId,
        bytes32 _discountData, bytes32 _merkleRoot, bytes32[] calldata _merkleProof) external view returns(bool);


    /** @dev Emitted when `provider` disables a subscription plan */
    event PlanDisabled(address indexed provider, uint32 indexed planId);

    /** @dev Emitted when `provider` enables a subscription plan */
    event PlanEnabled(address indexed provider, uint32 indexed planId);

    /** @dev Emitted when `provider` end-of-lifes a subscription plan */
    event PlanEOL(address indexed provider, uint32 indexed planId, uint32 eolAt);

}