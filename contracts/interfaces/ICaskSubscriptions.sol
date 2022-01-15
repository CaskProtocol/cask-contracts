// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICaskSubscriptions {

    enum SubscriptionStatus {
        None,
        Trialing,
        Active,
        Paused,
        Canceled,
        PendingCancel,
        PastDue
    }

    struct Subscription {
        bytes32 planId;
        bytes32 pendingPlanId;
        uint256 price;
        bytes32 discountId;
        address consumer;
        address provider;
        bytes32 metaHash; // the three meta* members are used to build an IPFS CID efficiently
        bytes32 ref;
        uint32 createdAt;
        uint32 renewAt;
        uint32 minTermAt;
        uint32 cancelAt;
        uint16 paymentNumber;
        uint8 metaHF;
        uint8 metaSize;
        SubscriptionStatus status;
    }


    /************************** SUBSCRIPTION INSTANCE METHODS **************************/

    function createSubscription(bytes32 _planId, bytes32 _discountProof, bytes32 _ref, uint32 _cancelAt,
        bytes32 _metaHash, uint8 _metaHF, uint8 _metaSize) external;

    function changeSubscriptionPlan(bytes32 _subscriptionId, bytes32 _planId) external;

    function changeSubscriptionCancelAt(bytes32 _subscriptionId, uint32 _cancelAt) external;

    function changeSubscriptionDiscount(bytes32 _subscriptionId, bytes32 _discountProof) external;

    function pauseSubscription(bytes32 _subscriptionId) external;

    function resumeSubscription(bytes32 _subscriptionId) external;

    function cancelSubscription(bytes32 _subscriptionId) external;

    function getSubscription(bytes32 _subscriptionId) external view returns (Subscription memory);

    function getConsumerSubscriptions(address _consumer, uint256 limit,
        uint256 offset) external view returns (bytes32[] memory);

    function getConsumerSubscriptionCount(address _consumer) external view returns (uint256);

    function getProviderSubscriptions(address _provider, uint256 limit,
        uint256 offset) external view returns (bytes32[] memory);

    function getProviderSubscriptionCount(address _provider) external view returns (uint256);


    /************************** SUBSCRIPTION EVENTS **************************/

    /** @dev Emitted when `consumer` subscribes to `provider` plan `planId` */
    event SubscriptionCreated(address indexed consumer, address indexed provider,
        bytes32 indexed subscriptionId, bytes32 ref, bytes32 planCode);

    /** @dev Emitted when `provider` verifies subscription `subscriptionId` */
    event SubscriptionVerified(address indexed consumer, address indexed provider,
        bytes32 indexed subscriptionId, bytes32 ref, bytes32 planCode);

    /** @dev Emitted when `consumer` changes the plan to `provider` on subscription `subscriptionId` */
    event SubscriptionChangedPlan(address indexed consumer, address indexed provider,
        bytes32 indexed subscriptionId, bytes32 ref, bytes32 oldPlanCode, bytes32 planCode);

    /** @dev Emitted when `consumer` changes the plan to `provider` on subscription `subscriptionId` */
    event SubscriptionPendingChangePlan(address indexed consumer, address indexed provider,
        bytes32 indexed subscriptionId, bytes32 ref, bytes32 oldPlanCode, bytes32 planCode);

    /** @dev Emitted when `consumer` changes the discount on subscription `subscriptionId` */
    event SubscriptionChangedDiscount(address indexed consumer, address indexed provider,
        bytes32 indexed subscriptionId, bytes32 ref, bytes32 planCode, bytes32 discountId);

    /** @dev Emitted when `consumer` pauses the subscription to `provider` on subscription `subscriptionId` */
    event SubscriptionPaused(address indexed consumer, address indexed provider,
        bytes32 indexed subscriptionId, bytes32 ref, bytes32 planCode);

    /** @dev Emitted when `consumer` resumes the subscription to `provider` on subscription `subscriptionId` */
    event SubscriptionResumed(address indexed consumer, address indexed provider,
        bytes32 indexed subscriptionId, bytes32 ref, bytes32 planCode);

    /** @dev Emitted when `consumer` unsubscribes to `provider` on subscription `subscriptionId` */
    event SubscriptionPendingCancel(address indexed consumer, address indexed provider,
        bytes32 indexed subscriptionId, bytes32 ref, bytes32 planCode);

    /** @dev Emitted when `consumer` has canceled and the current period is over on subscription `subscriptionId` */
    event SubscriptionCanceled(address indexed consumer, address indexed provider,
        bytes32 indexed subscriptionId, bytes32 ref, bytes32 planCode);

    /** @dev Emitted when `consumer` successfully renews to `provider` on subscription `subscriptionId` */
    event SubscriptionRenewed(address indexed consumer, address indexed provider,
        bytes32 indexed subscriptionId, bytes32 ref, bytes32 planCode);

    /** @dev Emitted when `consumer` subscription trial ends and goes active to `provider` on subscription `subscriptionId` */
    event SubscriptionTrialEnded(address indexed consumer, address indexed provider,
        bytes32 indexed subscriptionId, bytes32 ref, bytes32 planCode);

    /** @dev Emitted when `consumer` renewal fails to `provider` on subscription `subscriptionId` */
    event SubscriptionPastDue(address indexed consumer, address indexed provider,
        bytes32 indexed subscriptionId, bytes32 ref, bytes32 planCode);

}

