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
        uint16 freeTrialDays; // in days
        bool canPause;
        PlanStatus status;
    }

    struct Discount {
        uint16 percent; // percent in bps. 50% = 5000.
        uint32 expiresAt;
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

    function createSubscriptionPlan(bytes32 _planCode, uint32 _period,
        uint256 _price, uint16 _freeTrialDays, bool _canPause, address _payoutAddress,
        bytes32 _metaHash, uint8 _metaHF, uint8 _metaSize) external;

    function updateSubscriptionPlan(bytes32 _planId, uint32 _period, uint256 _price,
        uint16 _freeTrialDays, bool canPause) external;

    function setSubscriptionPlanDiscount(bytes32 _planId, bytes32 _discountId,
        uint8 _percent, uint32 expiresAt, uint32 maxUses) external;

    function consumeDiscount(bytes32 _planId, bytes32 _discountId) external returns(bool);

    function disableSubscriptionPlan(bytes32 _planId) external;

    function enableSubscriptionPlan(bytes32 _planId) external;

    function eolSubscriptionPlan(bytes32 _planId) external;

    function verifyDiscount(bytes32 _planId, bytes32 _discountProof) external view returns(bytes32);

    function getSubscriptionPlans(address _provider) external view returns(bytes32[] memory);

    function getSubscriptionPlan(bytes32 _planId) external view returns(Plan memory);

    function getSubscriptionPlanDiscount(bytes32 _planId, bytes32 _discountId) external view returns(Discount memory);

    function getSubscriptionPlanDiscounts(bytes32 _planId) external view returns (bytes32[] memory);



    /** @dev Emitted when `provider` creates a new subscription plan */
    event SubscriptionPlanCreated(address indexed provider, bytes32 indexed planId, bytes32 indexed planCode);

    /** @dev Emitted when `provider` updates a subscription plan */
    event SubscriptionPlanUpdated(address indexed provider, bytes32 indexed planId, bytes32 indexed planCode);

    /** @dev Emitted when `provider` adds a discount to a subscription plan */
    event SubscriptionPlanSetDiscount(address indexed provider, bytes32 indexed planId,
        bytes32 indexed planCode, bytes32 discountId);

    /** @dev Emitted when `provider` disables a subscription plan */
    event SubscriptionPlanDisabled(address indexed provider, bytes32 indexed planId, bytes32 indexed planCode);

    /** @dev Emitted when `provider` enables a subscription plan */
    event SubscriptionPlanEnabled(address indexed provider, bytes32 indexed planId, bytes32 indexed planCode);

    /** @dev Emitted when `provider` end-of-lifes a subscription plan */
    event SubscriptionPlanEOL(address indexed provider, bytes32 indexed planId, bytes32 indexed planCode);

}