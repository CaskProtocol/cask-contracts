// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICaskSubscriptionPlans {

    enum PlanStatus {
        None,
        Enabled,
        Disabled,
        EndOfLife
    }

    struct Plan {
        address provider;
        address paymentAddress;
        uint256 price; // denominated in baseAsset
        bytes32 planCode;
        bytes32 metaHash; // the three meta* members are used to build an IPFS CID efficiently
        uint8 metaHF;
        uint8 metaSize;
        uint32 period; // in seconds
        uint32 freeTrial; // in seconds
        uint32 minTerm; // in seconds
        uint32 maxPastDue; // in seconds
        bool canPause;
        PlanStatus status;
    }

    struct Discount {
        uint16 percent; // percent in bps. 50% = 5000.
        uint32 expiresAt;
        uint32 validAfter;
        uint32 maxUses;
        uint32 uses;
    }

    struct Provider {
        bytes32 metaHash; // the three meta* members are used to build an IPFS CID efficiently
        uint8 metaHF;
        uint8 metaSize;
    }

    function setProviderProfile(bytes32 _metaHash, uint8 _metaHF, uint8 _metaSize) external;

    function getProviderProfile(address _provider) external view returns(Provider memory);

    function createPlan(bytes32 _planCode, uint32 _period,
        uint256 _price, uint32 _minTerm, uint32 _freeTrial, bool _canPause, uint32 _maxPastDue,
        address _payoutAddress, bytes32 _metaHash, uint8 _metaHF, uint8 _metaSize) external;

    function updatePlan(bytes32 _planId, uint256 _price, uint32 _minTerm,
        uint32 _freeTrial, bool canPause, uint32 _maxPastDue) external;

    function setPlanDiscounts(bytes32 _planId, bytes32[] calldata _discountIds,
        uint16 _percent, uint32 expiresAt, uint32 maxUses) external;

    function updatePlanMeta(bytes32 _planId, bytes32 _metaHash, uint8 _metaHF, uint8 _metaSize) external;

    function consumeDiscount(bytes32 _planId, bytes32 _discountId) external returns(bool);

    function disablePlan(bytes32 _planId) external;

    function enablePlan(bytes32 _planId) external;

    function killPlan(bytes32 _planId) external;

    function verifyDiscount(bytes32 _planId, bytes32 _discountProof) external view returns(bytes32);

    function getPlans(address _provider) external view returns(bytes32[] memory);

    function getPlan(bytes32 _planId) external view returns(Plan memory);

    function getPlanDiscount(bytes32 _planId, bytes32 _discountId) external view returns(Discount memory);

    function getPlanDiscounts(bytes32 _planId) external view returns (bytes32[] memory);



    /** @dev Emitted when `provider` creates a new subscription plan */
    event PlanCreated(address indexed provider, bytes32 indexed planId, bytes32 indexed planCode);

    /** @dev Emitted when `provider` updates a subscription plan */
    event PlanUpdated(address indexed provider, bytes32 indexed planId, bytes32 indexed planCode);

    /** @dev Emitted when `provider` updates IPFS metadata for the plan */
    event PlanUpdatedMeta(address indexed provider, bytes32 indexed planId, bytes32 indexed planCode,
        bytes32 metaHash, uint8 metaHF, uint8 metaSize);

    /** @dev Emitted when `provider` disables a subscription plan */
    event PlanDisabled(address indexed provider, bytes32 indexed planId, bytes32 indexed planCode);

    /** @dev Emitted when `provider` enables a subscription plan */
    event PlanEnabled(address indexed provider, bytes32 indexed planId, bytes32 indexed planCode);

    /** @dev Emitted when `provider` end-of-lifes a subscription plan */
    event PlanKilled(address indexed provider, bytes32 indexed planId, bytes32 indexed planCode);

}