// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../interfaces/ICaskSubscriptionManager.sol";
import "../interfaces/ICaskSubscriptions.sol";
import "../interfaces/ICaskSubscriptionPlans.sol";

contract CaskSubscriptions is
ICaskSubscriptions,
ERC721Upgradeable,
OwnableUpgradeable,
PausableUpgradeable
{
    using ECDSA for bytes32;

    /************************** PARAMETERS **************************/

    /** @dev contract to manage subscription plan definitions. */
    ICaskSubscriptionManager public subscriptionManager;

    /** @dev contract to manage subscription plan definitions. */
    ICaskSubscriptionPlans public subscriptionPlans;

    /** @dev max gas refund for transactions, in wei */
    uint256 public gasRefundLimitCreateSubscription;
    uint256 public gasRefundLimitChangeSubscription;
    uint256 public gasRefundLimitCancelSubscription;
    uint256 public gasRefundLimitOther;


    /************************** STATE **************************/

    uint256[] private allSubscriptions;

    /** @dev Maps for consumer to list of subscriptions. */
    mapping(address => uint256[]) private consumerSubscriptions; // consumer => subscriptionId[]
    mapping(uint256 => Subscription) private subscriptions; // subscriptionId => Subscription
    mapping(uint256 => bytes32) private pendingPlanChanges; // subscriptionId => planData

    /** @dev Maps for provider to list of subscriptions and plans. */
    mapping(address => uint256[]) private providerSubscriptions; // provider => subscriptionId[]
    mapping(address => uint256) private providerActiveSubscriptionCount; // provider => count
    mapping(address => mapping(uint32 => uint256)) private planActiveSubscriptionCount; // provider => planId => count


    modifier onlyManager() {
        require(msg.sender == address(subscriptionManager), "!AUTH");
        _;
    }

    modifier onlySubscriber(uint256 _subscriptionId) {
        require(msg.sender == ownerOf(_subscriptionId), "!AUTH");
        _;
    }

    modifier onlySubscriberOrProvider(uint256 _subscriptionId) {
        require(
            msg.sender == ownerOf(_subscriptionId) ||
            msg.sender == subscriptions[_subscriptionId].provider,
            "!AUTH"
        );
        _;
    }

    function initialize(
        address _subscriptionPlans
    ) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ERC721_init("Cask Subscriptions","CASKSUBS");

        subscriptionPlans = ICaskSubscriptionPlans(_subscriptionPlans);

        // parameter defaults
        gasRefundLimitCreateSubscription = 0;
        gasRefundLimitChangeSubscription = 0;
        gasRefundLimitCancelSubscription = 0;
        gasRefundLimitOther = 0;
    }
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}


    function tokenURI(uint256 _subscriptionId) public view override returns (string memory) {
        require(_exists(_subscriptionId), "ERC721Metadata: URI query for nonexistent token");

        Subscription memory subscription = subscriptions[_subscriptionId];

        // TODO: do we want the token to point to provider CID or subscription CID?
//        ICaskSubscriptionPlans.Provider memory profile = subscriptionPlans.getProviderProfile(subscription.provider);
//        return string(abi.encodePacked("ipfs://", profile.cid, "/token"));

        return string(abi.encodePacked("ipfs://", subscription.cid));
    }

    function _beforeTokenTransfer(
        address _from,
        address _to,
        uint256 _subscriptionId
    ) internal override {
        if (_from != address(0) && _to != address(0)) { // only non-mint/burn transfers
            Subscription storage subscription = subscriptions[_subscriptionId];

            PlanInfo memory planInfo = _parsePlanData(subscription.planData);
            require(planInfo.canTransfer, "!NOT_TRANSFERRABLE");

            require(subscription.minTermAt == 0 || uint32(block.timestamp) >= subscription.minTermAt, "!MIN_TERM");

            // on transfer, set subscription to cancel at next renewal until new owner accepts subscription
            subscription.cancelAt = subscription.renewAt;
        }
    }

    /************************** SUBSCRIPTION METHODS **************************/

    function createNetworkSubscription(
        bytes32[] calldata _planProof,  // [provider, ref, planData, merkleRoot, merkleProof...]
        bytes32[] calldata _discountProof, // [discountCodeProof, discountData, merkleRoot, merkleProof...]
        bytes32 _networkData,
        uint32 _cancelAt,
        bytes memory _providerSignature,
        bytes memory _networkSignature,
        string calldata _cid
    ) external override whenNotPaused {
        uint256 initialGasLeft = gasleft();
        uint256 subscriptionId = _createSubscription(_planProof, _discountProof, _cancelAt,
            _providerSignature, _cid);

        _verifyNetworkData(_networkData, _networkSignature);

        Subscription storage subscription = subscriptions[subscriptionId];
        subscription.networkData = _networkData;
        subscriptionManager.rebateGas(initialGasLeft, gasRefundLimitCreateSubscription);
    }

    function createSubscription(
        bytes32[] calldata _planProof, // [provider, ref, planData, merkleRoot, merkleProof...]
        bytes32[] calldata _discountProof, // [discountCodeProof, discountData, merkleRoot, merkleProof...]
        uint32 _cancelAt,
        bytes memory _providerSignature,
        string calldata _cid
    ) external override whenNotPaused {
        uint256 initialGasLeft = gasleft();
        _createSubscription(_planProof, _discountProof, _cancelAt, _providerSignature, _cid);
        subscriptionManager.rebateGas(initialGasLeft, gasRefundLimitCreateSubscription);
    }

    function changeSubscriptionPlan(
        uint256 _subscriptionId,
        bytes32[] calldata _planProof,  // [provider, ref, planData, merkleRoot, merkleProof...]
        bytes32[] calldata _discountProof, // [discountCodeProof, discountData, merkleRoot, merkleProof...]
        bytes memory _providerSignature,
        string calldata _cid
    ) external override onlySubscriber(_subscriptionId) whenNotPaused {
        uint256 initialGasLeft = gasleft();
        _changeSubscriptionPlan(_subscriptionId, _planProof, _discountProof, _providerSignature, _cid);
        subscriptionManager.rebateGas(initialGasLeft, gasRefundLimitChangeSubscription);
    }

    function changeSubscriptionCancelAt(
        uint256 _subscriptionId,
        uint32 _cancelAt
    ) external override onlySubscriber(_subscriptionId) whenNotPaused {
        uint256 initialGasLeft = gasleft();

        Subscription storage subscription = subscriptions[_subscriptionId];

        require(subscription.minTermAt == 0 || _cancelAt >= subscription.minTermAt, "!MIN_TERM");

        subscription.cancelAt = _cancelAt;

        subscriptionManager.rebateGas(initialGasLeft, gasRefundLimitOther);
    }

    function changeSubscriptionDiscount(
        uint256 _subscriptionId,
        bytes32[] calldata _discountProof // [discountCodeProof, discountData, merkleRoot, merkleProof...]
    ) external override onlySubscriberOrProvider(_subscriptionId) whenNotPaused {
        uint256 initialGasLeft = gasleft();

        Subscription storage subscription = subscriptions[_subscriptionId];
        require(subscription.discountId == 0, "!EXISTING_DISCOUNT");

        if (pendingPlanChanges[_subscriptionId] > 0) {
            PlanInfo memory newPlanInfo = _parsePlanData(pendingPlanChanges[_subscriptionId]);
            // pending plan change, get discount for new plan
            (
            subscription.discountId,
            subscription.discountData
            ) = _verifyDiscountProof(subscription.provider, newPlanInfo.planId, _discountProof);
        } else {
            (
            subscription.discountId,
            subscription.discountData
            ) = _verifyDiscountProof(subscription.provider, subscription.planId, _discountProof);
        }

        emit SubscriptionChangedDiscount(ownerOf(_subscriptionId), subscription.provider, _subscriptionId,
            subscription.ref, subscription.planId, subscription.discountData);

        if (msg.sender == ownerOf(_subscriptionId)) {
            subscriptionManager.rebateGas(initialGasLeft, gasRefundLimitOther);
        }
    }

    function pauseSubscription(
        uint256 _subscriptionId
    ) external override onlySubscriberOrProvider(_subscriptionId) whenNotPaused {
        uint256 initialGasLeft = gasleft();

        Subscription storage subscription = subscriptions[_subscriptionId];

        require(subscription.status != SubscriptionStatus.Paused &&
                subscription.status != SubscriptionStatus.PastDue &&
                subscription.status != SubscriptionStatus.Canceled &&
                subscription.status != SubscriptionStatus.PendingCancel, "!INVALID(status)");

        require(subscription.minTermAt == 0 || uint32(block.timestamp) >= subscription.minTermAt, "!MIN_TERM");

        PlanInfo memory planInfo = _parsePlanData(subscription.planData);
        require(planInfo.canPause, "!NOT_PAUSABLE");

        subscription.status = SubscriptionStatus.Paused;

        planActiveSubscriptionCount[subscription.provider][subscription.planId] -= 1;

        emit SubscriptionPaused(ownerOf(_subscriptionId), subscription.provider, _subscriptionId,
            subscription.ref, subscription.planId);

        if (msg.sender == ownerOf(_subscriptionId)) {
            subscriptionManager.rebateGas(initialGasLeft, gasRefundLimitOther);
        }
    }

    function resumeSubscription(
        uint256 _subscriptionId
    ) external override onlySubscriber(_subscriptionId) whenNotPaused {
        uint256 initialGasLeft = gasleft();

        Subscription storage subscription = subscriptions[_subscriptionId];
        require(subscription.status == SubscriptionStatus.Paused, "!NOT_PAUSED");

        PlanInfo memory planInfo = _parsePlanData(subscription.planData);

        require(planInfo.maxActive == 0 ||
            planActiveSubscriptionCount[subscription.provider][planInfo.planId] < planInfo.maxActive, "!MAX_ACTIVE");

        subscription.status = SubscriptionStatus.Active;

        planActiveSubscriptionCount[subscription.provider][subscription.planId] += 1;

        // if renewal date has already passed, set it to now so consumer is not charged for the time it was paused
        if (subscription.renewAt < uint32(block.timestamp)) {
            subscription.renewAt = uint32(block.timestamp);
        }

        emit SubscriptionResumed(ownerOf(_subscriptionId), subscription.provider, _subscriptionId,
            subscription.ref, subscription.planId);

        subscriptionManager.rebateGas(initialGasLeft, gasRefundLimitOther);
    }

    function cancelSubscription(
        uint256 _subscriptionId
    ) external override onlySubscriberOrProvider(_subscriptionId) whenNotPaused {
        uint256 initialGasLeft = gasleft();

        Subscription storage subscription = subscriptions[_subscriptionId];

        require(subscription.status != SubscriptionStatus.PendingCancel &&
                subscription.status != SubscriptionStatus.Canceled, "!INVALID(status)");

        require(subscription.minTermAt == 0 || uint32(block.timestamp) >= subscription.minTermAt, "!MIN_TERM");

        subscription.status = SubscriptionStatus.PendingCancel;

        emit SubscriptionPendingCancel(ownerOf(_subscriptionId), subscription.provider, _subscriptionId,
            subscription.ref, subscription.planId);

        if (msg.sender == ownerOf(_subscriptionId)) {
            subscriptionManager.rebateGas(initialGasLeft, gasRefundLimitCancelSubscription);
        }
    }

    function managerPlanChange(
        uint256 _subscriptionId
    ) external override onlyManager whenNotPaused {
        bytes32 pendingPlanData = pendingPlanChanges[_subscriptionId];
        require(pendingPlanData > 0, "!INVALID(pendingPlanData)");

        Subscription storage subscription = subscriptions[_subscriptionId];
        PlanInfo memory newPlanInfo = _parsePlanData(pendingPlanData);

        emit SubscriptionChangedPlan(ownerOf(_subscriptionId), subscription.provider, _subscriptionId,
            subscription.ref, subscription.planId, newPlanInfo.planId, subscription.discountId);

        subscription.planId = newPlanInfo.planId;
        subscription.planData = pendingPlanData;

        if (newPlanInfo.minPeriods > 0) {
            subscription.minTermAt = uint32(block.timestamp + (newPlanInfo.period * newPlanInfo.minPeriods));
        }

        delete pendingPlanChanges[_subscriptionId]; // free up memory
    }

    function managerCancelSubscription(
        uint256 _subscriptionId
    ) external override onlyManager whenNotPaused {
        Subscription storage subscription = subscriptions[_subscriptionId];

        subscription.status = SubscriptionStatus.Canceled;

        providerActiveSubscriptionCount[subscription.provider] -= 1;
        planActiveSubscriptionCount[subscription.provider][subscription.planId] -= 1;

        emit SubscriptionCanceled(ownerOf(_subscriptionId), subscription.provider, _subscriptionId,
            subscription.ref, subscription.planId);

        _burn(_subscriptionId);
    }

    function managerPastDueSubscription(
        uint256 _subscriptionId
    ) external override onlyManager whenNotPaused {
        Subscription storage subscription = subscriptions[_subscriptionId];

        subscription.status = SubscriptionStatus.PastDue;

        emit SubscriptionPastDue(ownerOf(_subscriptionId), subscription.provider, _subscriptionId,
            subscription.ref, subscription.planId);
    }

    function managerRenewSubscription(
        uint256 _subscriptionId
    ) external override onlyManager whenNotPaused {
        Subscription storage subscription = subscriptions[_subscriptionId];
        PlanInfo memory planInfo = _parsePlanData(subscription.planData);

        if (subscription.status == SubscriptionStatus.Trialing) {
            emit SubscriptionTrialEnded(ownerOf(_subscriptionId), subscription.provider,
                _subscriptionId, subscription.ref, subscription.planId);
        }

        subscription.status = SubscriptionStatus.Active; // just in case it was something else previously
        subscription.renewAt = subscription.renewAt + planInfo.period;

        emit SubscriptionRenewed(ownerOf(_subscriptionId), subscription.provider, _subscriptionId,
            subscription.ref, subscription.planId);
    }

    function managerClearDiscount(
        uint256 _subscriptionId
    ) external override onlyManager whenNotPaused {
        Subscription storage subscription = subscriptions[_subscriptionId];
        subscription.discountData = 0;
    }

    function getAllSubscriptionsCount() external view returns (uint256) {
        return allSubscriptions.length;
    }

    function getAllSubscriptions() external override view returns (uint256[] memory) {
        return allSubscriptions;
    }

    function getSubscription(
        uint256 _subscriptionId
    ) external override view returns (Subscription memory) {
        return subscriptions[_subscriptionId];
    }

    function getConsumerSubscriptions(
        address _consumer,
        uint256 limit,
        uint256 offset
    ) external override view returns (uint256[] memory) {
        uint256[] memory subscriptionIds = new uint256[](limit);
        for (uint256 i = 0; i < limit; i++) {
            subscriptionIds[i] = consumerSubscriptions[_consumer][i+offset];
        }
        return subscriptionIds;
    }

    function getConsumerSubscriptionCount(
        address _consumer
    ) external override view returns (uint256) {
        return consumerSubscriptions[_consumer].length;
    }

    function getProviderSubscriptions(
        address _provider,
        uint256 limit,
        uint256 offset
    ) external override view returns (uint256[] memory) {
        uint256[] memory subscriptionIds = new uint256[](limit);
        for (uint256 i = 0; i < limit; i++) {
            subscriptionIds[i] = providerSubscriptions[_provider][i+offset];
        }
        return subscriptionIds;
    }

    function getProviderSubscriptionCount(
        address _provider
    ) external override view returns (uint256) {
        return providerSubscriptions[_provider].length;
    }

    function getProviderActiveSubscriptionCount(
        address _provider
    ) external override view returns (uint256) {
        return providerActiveSubscriptionCount[_provider];
    }

    function getProviderPlanActiveSubscriptionCount(
        address _provider,
        uint32 _planId
    ) external override view returns (uint256) {
        return planActiveSubscriptionCount[_provider][_planId];
    }

    function getPendingPlanChange(
        uint256 _subscriptionId
    ) external override view returns (bytes32) {
        return pendingPlanChanges[_subscriptionId];
    }

    function _createSubscription(
        bytes32[] calldata _planProof,  // [provider, ref, planData, merkleRoot, merkleProof...]
        bytes32[] calldata _discountProof, // [discountCodeProof, discountData, merkleRoot, merkleProof...]
        uint32 _cancelAt,
        bytes memory _providerSignature,
        string calldata _cid
    ) internal returns(uint256) {
        require(_planProof.length >= 4, "!INVALID(planProofLen)");

        // confirms merkleroots are in fact the ones provider committed to
        address provider;
        if (_discountProof.length >= 3) {
            provider = _verifyMerkleRoots(_planProof[0], _providerSignature, _planProof[3], _discountProof[2]);
        } else {
            provider = _verifyMerkleRoots(_planProof[0], _providerSignature, _planProof[3], 0);
        }

        // confirms plan data is included in merkle root
        require(_verifyPlanProof(_planProof), "!INVALID(planProof)");

        // decode planData bytes32 into PlanInfo
        PlanInfo memory planInfo = _parsePlanData(_planProof[2]);

        // generate subscriptionId from plan info and ref
        uint256 subscriptionId = _generateSubscriptionId(_planProof[0], _planProof[1], _planProof[2]);

        require(planInfo.maxActive == 0 ||
            planActiveSubscriptionCount[provider][planInfo.planId] < planInfo.maxActive, "!MAX_ACTIVE");
        require(subscriptionPlans.getPlanStatus(provider, planInfo.planId) ==
            ICaskSubscriptionPlans.PlanStatus.Enabled, "!NOT_ENABLED");

        _safeMint(msg.sender, subscriptionId);

        Subscription storage subscription = subscriptions[subscriptionId];

        subscription.provider = provider;
        subscription.planId = planInfo.planId;
        subscription.ref = _planProof[1];
        subscription.planData = _planProof[2];
        subscription.cancelAt = _cancelAt;
        subscription.cid = _cid;
        subscription.createdAt = uint32(block.timestamp);

        if (planInfo.minPeriods > 0) {
            subscription.minTermAt = uint32(block.timestamp + (planInfo.period * planInfo.minPeriods));
        }

        if (planInfo.freeTrial > 0) {
            // if no trial period, charge now. If trial period, charge will happen after trial is over
            subscription.status = SubscriptionStatus.Trialing;
            subscription.renewAt = uint32(block.timestamp) + planInfo.freeTrial;
        }

        (
        subscription.discountId,
        subscription.discountData
        ) = _verifyDiscountProof(subscription.provider, planInfo.planId, _discountProof);

        if (subscription.renewAt <= uint32(block.timestamp)) {
            subscriptionManager.renewSubscription(subscriptionId);
        }

        emit SubscriptionCreated(ownerOf(subscriptionId), subscription.provider, subscriptionId,
            subscription.ref, subscription.planId, subscription.discountId);

        consumerSubscriptions[msg.sender].push(subscriptionId);
        providerSubscriptions[provider].push(subscriptionId);
        providerActiveSubscriptionCount[provider] += 1;
        planActiveSubscriptionCount[provider][planInfo.planId] += 1;
        allSubscriptions.push(subscriptionId);

        return subscriptionId;
    }

    function _changeSubscriptionPlan(
        uint256 _subscriptionId,
        bytes32[] calldata _planProof,  // [provider, ref, planData, merkleRoot, merkleProof...]
        bytes32[] calldata _discountProof, // [discountCodeProof, discountData, merkleRoot, merkleProof...]
        bytes memory _providerSignature,
        string calldata _cid
    ) internal {
        require(_planProof.length >= 4, "!INVALID(planProof)");

        Subscription storage subscription = subscriptions[_subscriptionId];

        require(subscription.renewAt > uint32(block.timestamp), "!NEED_RENEWAL");
        require(subscription.status == SubscriptionStatus.Active ||
            subscription.status == SubscriptionStatus.Trialing, "!INVALID(status)");

        // confirms merkleroots are in fact the ones provider committed to
        address provider;
        if (_discountProof.length >= 3) {
            provider = _verifyMerkleRoots(_planProof[0], _providerSignature, _planProof[3], _discountProof[2]);
        } else {
            provider = _verifyMerkleRoots(_planProof[0], _providerSignature, _planProof[3], 0);
        }

        // confirms plan data is included in merkle root
        require(_verifyPlanProof(_planProof), "!INVALID(planProof)");

        // decode planData bytes32 into PlanInfo
        PlanInfo memory newPlanInfo = _parsePlanData(_planProof[2]);

        require(subscription.provider == provider, "!INVALID(provider)");

        subscription.cid = _cid;

        if (subscription.discountId == 0 && _discountProof.length >= 3 && _discountProof[0] > 0) {
            (
            subscription.discountId,
            subscription.discountData
            ) = _verifyDiscountProof(subscription.provider, newPlanInfo.planId, _discountProof);
        }

        if (subscription.planId != newPlanInfo.planId) {
            require(subscriptionPlans.getPlanStatus(provider, newPlanInfo.planId) ==
                ICaskSubscriptionPlans.PlanStatus.Enabled, "!NOT_ENABLED");
            _performPlanChange(_subscriptionId, newPlanInfo, _planProof[2]);
        }
    }

    function _performPlanChange(
        uint256 _subscriptionId,
        PlanInfo memory _newPlanInfo,
        bytes32 _planData
    ) internal {
        Subscription storage subscription = subscriptions[_subscriptionId];

        PlanInfo memory currentPlanInfo = _parsePlanData(subscription.planData);

        if (subscription.status == SubscriptionStatus.Trialing) { // still in trial, just change now

            _swapTrialingPlan(_subscriptionId, currentPlanInfo, _newPlanInfo, _planData);

        } else if (_newPlanInfo.price / _newPlanInfo.period ==
            currentPlanInfo.price / currentPlanInfo.period)
        { // straight swap

            _swapPlan(_subscriptionId, _newPlanInfo, _planData);

        } else if (_newPlanInfo.price / _newPlanInfo.period >
            currentPlanInfo.price / currentPlanInfo.period)
        { // upgrade

            _upgradePlan(_subscriptionId, currentPlanInfo, _newPlanInfo, _planData);

        } else { // downgrade - to take affect at next renewal

            _scheduleSwapPlan(_subscriptionId, _newPlanInfo.planId, _planData);
        }
    }

    function _verifyDiscountProof(
        address _provider,
        uint32 _planId,
        bytes32[] calldata _discountProof // [discountCodeProof, discountData, merkleRoot, merkleProof...]
    ) internal view returns(bytes32, bytes32) {
        if (_discountProof.length > 3 && _discountProof[0] > 0) {
            bytes32 discountId = keccak256(abi.encode(_discountProof[0]));
            if (subscriptionPlans.verifyDiscount(_provider, _planId, discountId,
                _discountProof[1], _discountProof[2], _discountProof[3:]))
            {
                return (discountId, _discountProof[1]);
            }
        }
        return (0,0);
    }

    function _verifyPlanProof(
        bytes32[] calldata _planProof // [provider, ref, planData, merkleRoot, merkleProof...]
    ) internal view returns(bool) {
        return subscriptionPlans.verifyPlan(_planProof[2], _planProof[3], _planProof[4:]);
    }

    function _generateSubscriptionId(
        bytes32 _providerAddr,
        bytes32 _ref,
        bytes32 _planData
    ) internal view returns(uint256) {
        return uint256(keccak256(abi.encodePacked(msg.sender, _providerAddr, _planData, _ref, block.number)));
    }

    function _parsePlanData(
        bytes32 _planData
    ) internal pure returns(PlanInfo memory) {
        bytes2 options = bytes2(_planData << 240);
        return PlanInfo({
            price: uint256(_planData >> 160),
            planId: uint32(bytes4(_planData << 96)),
            period: uint32(bytes4(_planData << 128)),
            freeTrial: uint32(bytes4(_planData << 160)),
            maxActive: uint32(bytes4(_planData << 192)),
            minPeriods: uint16(bytes2(_planData << 224)),
            canPause: options & 0x0001 == 0x0001,
            canTransfer: options & 0x0002 == 0x0002
        });
    }

    function _parseNetworkData(
        bytes32 _networkData
    ) internal pure returns(NetworkInfo memory) {
        return NetworkInfo({
            network: address(bytes20(_networkData)),
            feeBps: uint16(bytes2(_networkData << 160))
        });
    }

    function _swapTrialingPlan(
        uint256 _subscriptionId,
        PlanInfo memory _currentPlanInfo,
        PlanInfo memory _newPlanInfo,
        bytes32 _newPlanData
    ) internal {
        Subscription storage subscription = subscriptions[_subscriptionId];

        // adjust renewal based on new plan trial length
        subscription.renewAt = subscription.renewAt - _currentPlanInfo.freeTrial + _newPlanInfo.freeTrial;

        // if new plan trial length would have caused trial to already be over, end trial as of now
        // subscription will be charged and converted to active during next keeper run
        if (subscription.renewAt <= uint32(block.timestamp)) {
            subscription.renewAt = uint32(block.timestamp);
        }

        _swapPlan(_subscriptionId, _newPlanInfo, _newPlanData);
    }

    function _scheduleSwapPlan(
        uint256 _subscriptionId,
        uint32 newPlanId,
        bytes32 _newPlanData
    ) internal {
        Subscription storage subscription = subscriptions[_subscriptionId];

        pendingPlanChanges[_subscriptionId] = _newPlanData;

        emit SubscriptionPendingChangePlan(ownerOf(_subscriptionId), subscription.provider, _subscriptionId,
            subscription.ref, subscription.planId, newPlanId);
    }

    function _swapPlan(
        uint256 _subscriptionId,
        PlanInfo memory _newPlanInfo,
        bytes32 _newPlanData
    ) internal {
        Subscription storage subscription = subscriptions[_subscriptionId];

        emit SubscriptionChangedPlan(ownerOf(_subscriptionId), subscription.provider, _subscriptionId,
            subscription.ref, subscription.planId, _newPlanInfo.planId, subscription.discountId);

        if (_newPlanInfo.minPeriods > 0) {
            subscription.minTermAt = uint32(block.timestamp + (_newPlanInfo.period * _newPlanInfo.minPeriods));
        }

        subscription.planId = _newPlanInfo.planId;
        subscription.planData = _newPlanData;
    }

    function _upgradePlan(
        uint256 _subscriptionId,
        PlanInfo memory _currentPlanInfo,
        PlanInfo memory _newPlanInfo,
        bytes32 _newPlanData
    ) internal {
        Subscription storage subscription = subscriptions[_subscriptionId];

        uint256 newAmount = ((_newPlanInfo.price / _newPlanInfo.period) -
            (_currentPlanInfo.price / _currentPlanInfo.period)) *
            (subscription.renewAt - uint32(block.timestamp));

        subscriptionManager.processSinglePayment(ownerOf(_subscriptionId), subscription.provider,
            _subscriptionId, newAmount);

        _swapPlan(_subscriptionId, _newPlanInfo, _newPlanData);
    }


    /************************** ADMIN FUNCTIONS **************************/

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setManager(
        address _subscriptionManager
    ) external onlyOwner {
        subscriptionManager = ICaskSubscriptionManager(_subscriptionManager);
    }

    function setParameters(
        uint256 _gasRefundLimitCreateSubscription,
        uint256 _gasRefundLimitChangeSubscription,
        uint256 _gasRefundLimitCancelSubscription,
        uint256 _gasRefundLimitOther
    ) external onlyOwner {
        gasRefundLimitCreateSubscription = _gasRefundLimitCreateSubscription;
        gasRefundLimitChangeSubscription = _gasRefundLimitChangeSubscription;
        gasRefundLimitCancelSubscription = _gasRefundLimitCancelSubscription;
        gasRefundLimitOther = _gasRefundLimitOther;
    }

    function _verifyMerkleRoots(
        bytes32 providerAddr,
        bytes memory _providerSignature,
        bytes32 _planMerkleRoot,
        bytes32 _discountMerkleRoot
    ) internal pure returns (address) {
        address recovered = keccak256(abi.encode(_planMerkleRoot, _discountMerkleRoot))
            .toEthSignedMessageHash()
            .recover(_providerSignature);
        require(address(bytes20(providerAddr << 96)) == recovered, "!INVALID(proof)");
        return recovered;
    }

    function _verifyNetworkData(
        bytes32 _networkData,
        bytes memory _networkSignature
    ) internal pure returns (address) {
        address network = keccak256(abi.encode(_networkData))
            .toEthSignedMessageHash()
            .recover(_networkSignature);
        NetworkInfo memory networkInfo = _parseNetworkData(_networkData);
        require(networkInfo.network == network, "!INVALID(network)");
        return network;
    }

}