// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

import "../interfaces/ICaskSubscriptions.sol";
import "../interfaces/ICaskSubscriptionPlans.sol";
import "../interfaces/ICaskVault.sol";

contract CaskSubscriptions is
ICaskSubscriptions,
Initializable,
OwnableUpgradeable,
PausableUpgradeable,
KeeperCompatibleInterface
{

    /************************** STATE **************************/

    /** @dev contract to manage subscription plan definitions. */
    address public subscriptionPlans;

    /** @dev vault to use for payments. */
    address public vault;

    /** @dev fixed fee to charge on payments, in baseAsset decimal units. */
    uint256 public paymentFeeFixed;

    /** @dev percentage to charge on payments in 18 decimals. 100% = 1e18. */
    uint256 public paymentFeeRate;

    /** @dev max gas refund for subscription creation transactions, in wei */
    uint256 public gasRefundLimit;


    bytes32[] internal allSubscriptions;

    /** @dev Maps for consumer to list of subscriptions. */
    mapping(address => bytes32[]) internal consumerSubscriptions; // consumer => subscriptionId[]
    mapping(bytes32 => Subscription) internal subscriptions; // subscriptionId => Subscription

    /** @dev Maps for provider to list of subscriptions and plans. */
    mapping(address => bytes32[]) internal providerSubscriptions; // provider => subscriptionId[]
    mapping(address => uint256) internal providerActiveSubscriptionCount; // provider => count

    modifier onlySubscriber(bytes32 _subscriptionId) {
        require(msg.sender == subscriptions[_subscriptionId].consumer, "!auth");
        _;
    }

    modifier onlySubscriberOrProvider(bytes32 _subscriptionId) {
        require(
            msg.sender == subscriptions[_subscriptionId].consumer||
            msg.sender == subscriptions[_subscriptionId].provider,
            "!auth"
        );
        _;
    }

    modifier onlyProvider(bytes32 _subscriptionId) {
        require(msg.sender == subscriptions[_subscriptionId].provider, "!auth");
        _;
    }


    function initialize(
        address _subscriptionPlans,
        address _vault
    ) public initializer {
        __Ownable_init();
        __Pausable_init();

        subscriptionPlans = _subscriptionPlans;
        vault = _vault;

        // parameter defaults
        paymentFeeFixed = 0;
        paymentFeeRate = 0;
        gasRefundLimit = 0;
    }
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}



    /************************** SUBSCRIPTION METHODS **************************/

    function createSubscription(
        bytes32 _planId,
        bytes32 _discountProof,
        bytes32 _ref,
        uint32 _cancelAt,
        bytes32 _metaHash,
        uint8 _metaHF,
        uint8 _metaSize
    ) external override whenNotPaused {
        uint256 initialGasLeft = gasleft();
        initialGasLeft = initialGasLeft + 3000;

        ICaskSubscriptionPlans.Plan memory plan = ICaskSubscriptionPlans(subscriptionPlans).getSubscriptionPlan(_planId);

        require(plan.provider != address(0), "!invalid(_plan)");
        require(plan.status == ICaskSubscriptionPlans.PlanStatus.Enabled, "!disabled");

        bytes32 subscriptionId = keccak256(abi.encodePacked(msg.sender, plan.provider, _planId, block.number));

        Subscription storage subscription = subscriptions[subscriptionId];
        subscription.consumer = msg.sender;
        subscription.provider = plan.provider;
        subscription.planId = _planId;
        subscription.price = plan.price;
        subscription.pendingPlanId = 0;
        subscription.ref = _ref;
        subscription.cancelAt = _cancelAt;
        subscription.discountId = ICaskSubscriptionPlans(subscriptionPlans).verifyDiscount(_planId, _discountProof);
        subscription.metaHash = _metaHash;
        subscription.metaHF = _metaHF;
        subscription.metaSize = _metaSize;
        subscription.createdAt = uint32(block.timestamp);

        if (plan.freeTrialDays > 0) {
            // if no trial period, charge now. If trial period, charge will happen after trial is over
            subscription.status = SubscriptionStatus.Trialing;
            subscription.renewAt = uint32(block.timestamp) + (plan.freeTrialDays * 1 days);
        } else {
            _renewSubscription(subscriptionId);
            subscription.status = SubscriptionStatus.Active;
        }
        if (plan.minTerm > 0) {
            subscription.minTermAt = uint32(block.timestamp) + plan.minTerm;
        }

        emit SubscriptionCreated(subscription.consumer, subscription.provider,
            subscription.subscriptionId, subscription.ref, plan.planCode);

        consumerSubscriptions[msg.sender].push(subscriptionId);
        providerSubscriptions[plan.provider].push(subscriptionId);
        providerActiveSubscriptionCount[plan.provider] = providerActiveSubscriptionCount[plan.provider] + 1;
        allSubscriptions.push(subscriptionId);
        _rebateGas(initialGasLeft);
    }

    function changeSubscriptionPlan(
        bytes32 _subscriptionId,
        bytes32 _planId
    ) external override onlySubscriber(_subscriptionId) whenNotPaused {
        Subscription storage subscription = subscriptions[_subscriptionId];
        require(subscription.renewAt < uint32(block.timestamp), "!need_renewal");
        require(subscription.planId != _planId, "!invalid(_planId)");
        require(subscription.status == SubscriptionStatus.Active ||
                subscription.status == SubscriptionStatus.Trialing, "!invalid(status)");

        ICaskSubscriptionPlans.Plan memory plan = ICaskSubscriptionPlans(subscriptionPlans).getSubscriptionPlan(_planId);
        require(plan.status == ICaskSubscriptionPlans.PlanStatus.Enabled, "!disabled");

        ICaskSubscriptionPlans.Plan memory curPlan = ICaskSubscriptionPlans(subscriptionPlans).getSubscriptionPlan(subscription.planId);

        if (subscription.status == SubscriptionStatus.Trialing) {

            if (plan.freeTrialDays > curPlan.freeTrialDays) {
                // new plan has moar days than the old plan, adjust renewAt out further
                subscription.renewAt = subscription.renewAt + ((plan.freeTrialDays - curPlan.freeTrialDays) * 1 days);
            } else if (plan.freeTrialDays < curPlan.freeTrialDays) {
                // new plan has less days than the old plan, adjust renewAt in closer
                subscription.renewAt = subscription.renewAt - ((curPlan.freeTrialDays - plan.freeTrialDays) * 1 days);
                if (subscription.renewAt <= uint32(block.timestamp)) {
                    // if new plan trial days would have caused trial to already be over, end trial as of now
                    // subscription will be charged and converted to active during next keeper run
                    subscription.renewAt = uint32(block.timestamp);
                }
            }

            // freely allow plans to change while trialing
            subscription.planId = _planId;

            emit SubscriptionChangedPlan(subscription.consumer, subscription.provider, subscription.subscriptionId,
                subscription.ref, curPlan.planCode, plan.planCode);

        } else if (plan.price / plan.period > subscription.price / curPlan.period) { // upgrade
            uint256 newAmount = ((plan.price / plan.period) - (subscription.price / curPlan.period)) *
                                 (subscription.renewAt - uint32(block.timestamp));
            _processPayment(subscription.consumer, plan.paymentAddress, newAmount);

            subscription.planId = _planId;

            emit SubscriptionChangedPlan(subscription.consumer, subscription.provider, subscription.subscriptionId,
                subscription.ref, curPlan.planCode, plan.planCode);

        } else { // downgrade

            // possible usecase someday: code to immediately downgrade and extend renewal date based on plan value diff
//            uint256 credit = ((subscription.price / curPlan.period) - (plan.price / plan.period)) *
//                                (subscription.renewAt - uint32(block.timestamp));
//            // calculate how many seconds the credit amount buys of the new plan and extend
//            // the renewal date that amount
//            subscription.renewAt = subscription.renewAt + uint32(credit / (plan.price / plan.period));

            subscription.pendingPlanId = _planId; // will be activated at next renewal

            emit SubscriptionPendingChangePlan(subscription.consumer, subscription.provider, subscription.subscriptionId,
                subscription.ref, curPlan.planCode, plan.planCode);
        }

    }

    function changeSubscriptionCancelAt(
        bytes32 _subscriptionId,
        uint32 _cancelAt
    ) external override onlySubscriber(_subscriptionId) whenNotPaused {
        Subscription storage subscription = subscriptions[_subscriptionId];

        require(subscription.minTermAt == 0 || _cancelAt > subscription.minTermAt, "!min_term");

        subscription.cancelAt = _cancelAt;
    }

    function changeSubscriptionDiscount(
        bytes32 _subscriptionId,
        bytes32 _discountProof
    ) external override onlySubscriberOrProvider(_subscriptionId) whenNotPaused {
        Subscription storage subscription = subscriptions[_subscriptionId];

        ICaskSubscriptionPlans.Plan memory plan;
        if (subscription.pendingPlanId != 0 && subscription.planId != subscription.pendingPlanId) {
            // pending downgrade, get discount for new plan
            plan = ICaskSubscriptionPlans(subscriptionPlans).getSubscriptionPlan(subscription.pendingPlanId);

            subscription.discountId = ICaskSubscriptionPlans(subscriptionPlans).verifyDiscount(subscription.pendingPlanId, _discountProof);

            emit SubscriptionChangedDiscount(subscription.consumer, subscription.provider, subscription.subscriptionId,
                subscription.ref, plan.planCode, subscription.discountId);

        } else {
            plan = ICaskSubscriptionPlans(subscriptionPlans).getSubscriptionPlan(subscription.planId);

            subscription.discountId = ICaskSubscriptionPlans(subscriptionPlans).verifyDiscount(subscription.planId, _discountProof);

            emit SubscriptionChangedDiscount(subscription.consumer, subscription.provider, subscription.subscriptionId,
                subscription.ref, plan.planCode, subscription.discountId);
        }
    }

    function pauseSubscription(
        bytes32 _subscriptionId
    ) external override onlySubscriberOrProvider(_subscriptionId) whenNotPaused {
        Subscription storage subscription = subscriptions[_subscriptionId];
        ICaskSubscriptionPlans.Plan memory plan = ICaskSubscriptionPlans(subscriptionPlans).getSubscriptionPlan(subscription.planId);

        require(plan.canPause, "!unpausable");
        require(subscription.status != SubscriptionStatus.Paused &&
                subscription.status != SubscriptionStatus.PastDue &&
                subscription.status != SubscriptionStatus.Canceled &&
                subscription.status != SubscriptionStatus.PendingCancel, "!invalid");

        require(subscription.minTermAt == 0 || uint32(block.timestamp) > subscription.minTermAt, "!min_term");

        subscription.status = SubscriptionStatus.Paused;

        emit SubscriptionPaused(subscription.consumer, subscription.provider, subscription.subscriptionId,
            subscription.ref, plan.planCode);
    }

    function resumeSubscription(
        bytes32 _subscriptionId
    ) external override onlySubscriber(_subscriptionId) whenNotPaused {
        Subscription storage subscription = subscriptions[_subscriptionId];
        ICaskSubscriptionPlans.Plan memory plan = ICaskSubscriptionPlans(subscriptionPlans).getSubscriptionPlan(subscription.planId);

        require(subscription.status == SubscriptionStatus.Paused, "!not_paused");

        subscription.status = SubscriptionStatus.Active;

        // if renewal date has already passed, set it to now so consumer is not charged for the time it was paused
        if (subscription.renewAt < uint32(block.timestamp)) {
            subscription.renewAt = uint32(block.timestamp);
        }

        emit SubscriptionResumed(subscription.consumer, subscription.provider, subscription.subscriptionId,
            subscription.ref, plan.planCode);
    }

    function cancelSubscription(
        bytes32 _subscriptionId
    ) external override onlySubscriberOrProvider(_subscriptionId) whenNotPaused {
        Subscription storage subscription = subscriptions[_subscriptionId];

        require(subscription.status != SubscriptionStatus.PendingCancel &&
                subscription.status != SubscriptionStatus.Canceled, "!invalid(status)");

        require(subscription.minTermAt == 0 || uint32(block.timestamp) > subscription.minTermAt, "!min_term");

        ICaskSubscriptionPlans.Plan memory plan = ICaskSubscriptionPlans(subscriptionPlans).getSubscriptionPlan(subscription.planId);

        subscription.status = SubscriptionStatus.PendingCancel;

        emit SubscriptionPendingCancel(subscription.consumer, subscription.provider, subscription.subscriptionId,
            subscription.ref, plan.planCode);
    }

    function getSubscription(
        bytes32 _subscriptionId
    ) external override view returns (Subscription memory) {
        return subscriptions[_subscriptionId];
    }

    function getConsumerSubscriptions(
        address _consumer, uint256 limit, uint256 offset
    ) external override view returns (bytes32[] memory) {
        bytes32[] memory subscriptionIds = new bytes32[](limit);
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
        address _provider, uint256 limit, uint256 offset
    ) external override view returns (bytes32[] memory) {
        bytes32[] memory subscriptionIds = new bytes32[](limit);
        for (uint256 i = 0; i < limit + offset; i++) {
            subscriptionIds[i] = providerSubscriptions[_provider][i+offset];
        }
        return subscriptionIds;
    }

    function getProviderSubscriptionCount(
        address _provider
    ) external override view returns (uint256) {
        return providerSubscriptions[_provider].length;
    }


    /************************** OPERATIONAL METHODS **************************/

    function checkUpkeep(
        bytes calldata checkData
    ) external view override returns(bool upkeepNeeded, bytes memory performData) {
        uint256 limit = abi.decode(checkData, (uint256));
        bytes32[] memory subscriptionIds = _subscriptionsRenewable(limit);
        if (subscriptionIds.length > 0) {
            upkeepNeeded = true;
            performData = abi.encode(subscriptionIds);
        } else {
            upkeepNeeded = false;
            performData = bytes("");
        }
    }

    function _subscriptionsRenewable(
        uint256 _limit
    ) internal view returns(bytes32[] memory) {
        bytes32[] memory renewables = new bytes32[](_limit);

        uint256 foundRenewable = 0;
        for (uint256 i = 0; i < allSubscriptions.length; i++) {
            Subscription memory subscription = subscriptions[allSubscriptions[i]];
            if (subscription.renewAt <= uint32(block.timestamp) &&
                subscription.status != SubscriptionStatus.Canceled &&
                subscription.status != SubscriptionStatus.Paused)
            {
                renewables[foundRenewable] = allSubscriptions[i];
                foundRenewable = foundRenewable + 1;
                if (foundRenewable >= _limit) {
                    break;
                }
            }
        }
        return renewables;
    }

    function performUpkeep(
        bytes calldata performData
    ) external override whenNotPaused {
        bytes32[] memory subscriptionIds = abi.decode(performData, (bytes32[]));
        for (uint256 i = 0; i < subscriptionIds.length; i++) {
            if (subscriptionIds[i] != "") {
                _renewSubscription(subscriptionIds[i]);
            }
        }
    }

    function _renewSubscription(
        bytes32 _subscriptionId
    ) internal {
        Subscription storage subscription = subscriptions[_subscriptionId];

        // not time to renew yet or is paused
        if (subscription.renewAt > uint32(block.timestamp) ||
            subscription.status == SubscriptionStatus.Paused) {
            return;
        }

        ICaskSubscriptionPlans.Plan memory plan = ICaskSubscriptionPlans(subscriptionPlans).getSubscriptionPlan(subscription.planId);

        // subscription scheduled to be canceled by consumer or has hit its cancelAt time
        if (subscription.status == SubscriptionStatus.PendingCancel ||
            (subscription.cancelAt > 0 && subscription.cancelAt <= uint32(block.timestamp)) ||
            plan.status == ICaskSubscriptionPlans.PlanStatus.EndOfLife) {

            subscription.status = SubscriptionStatus.Canceled;
            providerActiveSubscriptionCount[subscription.provider] =
                providerActiveSubscriptionCount[subscription.provider] - 1;

            emit SubscriptionCanceled(subscription.consumer, subscription.provider, subscription.subscriptionId,
                subscription.ref, plan.planCode);

        } else {

            ICaskSubscriptionPlans.Discount memory discount;

            // if a plan change is pending, switch to use new plan info
            if (subscription.pendingPlanId != 0 && subscription.pendingPlanId != subscription.planId) {
                plan = ICaskSubscriptionPlans(subscriptionPlans).getSubscriptionPlan(subscription.pendingPlanId);
                discount = ICaskSubscriptionPlans(subscriptionPlans).getSubscriptionPlanDiscount(subscription.pendingPlanId, subscription.discountId);
            } else {
                discount = ICaskSubscriptionPlans(subscriptionPlans).getSubscriptionPlanDiscount(subscription.planId, subscription.discountId);
            }

            uint256 chargeAmount = subscription.price;
            bool usedDiscount = false;
            if (discount.percent > 0 && discount.expiresAt < uint32(block.timestamp)) {
                if (discount.maxUses == 0 || discount.uses < discount.maxUses) {
                    usedDiscount = true;
                    chargeAmount = chargeAmount - (chargeAmount * discount.percent / 10000);
                }
            }

            // consumer does not have enough balance to cover payment
            if (ICaskVault(vault).currentValueOf(subscription.consumer) < chargeAmount) {

                // if have not been able to renew for 7 days, cancel subscription
                if (subscription.renewAt < uint32(block.timestamp - 7 days)) {

                    providerActiveSubscriptionCount[subscription.provider] =
                        providerActiveSubscriptionCount[subscription.provider] - 1;
                    subscription.status = SubscriptionStatus.Canceled;

                    emit SubscriptionCanceled(subscription.consumer, subscription.provider,
                        subscription.subscriptionId, subscription.ref, plan.planCode);

                } else if (subscription.status != SubscriptionStatus.PastDue) {

                    subscription.status = SubscriptionStatus.PastDue;

                    emit SubscriptionPastDue(subscription.consumer, subscription.provider,
                        subscription.subscriptionId, subscription.ref, plan.planCode);
                }

            } else if (chargeAmount > 0) {

                subscription.renewAt = subscription.renewAt + plan.period;
                subscription.paymentNumber = subscription.paymentNumber + 1;

                _processPayment(subscription.consumer, plan.paymentAddress, chargeAmount);

                if (subscription.pendingPlanId != 0 && subscription.pendingPlanId != subscription.planId) {
                    ICaskSubscriptionPlans.Plan memory oldPlan = ICaskSubscriptionPlans(subscriptionPlans).getSubscriptionPlan(subscription.planId);

                    subscription.planId = subscription.pendingPlanId;
                    subscription.pendingPlanId = 0;

                    emit SubscriptionChangedPlan(subscription.consumer, subscription.provider,
                        subscription.subscriptionId, subscription.ref, oldPlan.planCode, plan.planCode);
                }

                if (usedDiscount && discount.maxUses > 0) {
                    // consume discount and if no more uses remain, drop discount from subscription (gas optimization)
                    if (!ICaskSubscriptionPlans(subscriptionPlans).consumeDiscount(subscription.planId, subscription.discountId)) {
                        subscription.discountId = 0; // clear discount since no more uses are available
                    }
                }

                if (subscription.status == SubscriptionStatus.Trialing) {
                    emit SubscriptionTrialEnded(subscription.consumer, subscription.provider,
                        subscription.subscriptionId, subscription.ref, plan.planCode);
                }

                subscription.status = SubscriptionStatus.Active;

                emit SubscriptionRenewed(subscription.consumer, subscription.provider, subscription.subscriptionId,
                    subscription.ref, plan.planCode);
            } else {
                subscription.renewAt = subscription.renewAt + plan.period;

                emit SubscriptionRenewed(subscription.consumer, subscription.provider, subscription.subscriptionId,
                    subscription.ref, plan.planCode);
            }

        }

    }

    function _processPayment(
        address _consumer,
        address _provider,
        uint256 _amount
    ) internal {
        // TODO: calculate the fee rate discount based on staked CASK
        uint256 paymentFeeRateAdjusted = paymentFeeRate;
        uint256 fee = paymentFeeFixed + (_amount * paymentFeeRateAdjusted / 10000);
        ICaskVault(vault).payment(_consumer, _provider, _amount, fee);
    }

    function _rebateGas(
        uint256 _initialGasLeft
    ) internal {
        if (gasRefundLimit == 0) {
            return;
        }

        // assume a fixed 30000 wei for transaction overhead and stuff performed after this snapshot
        uint256 weiRebate = (_initialGasLeft - gasleft() + 30000) * tx.gasprice;
        if (weiRebate > gasRefundLimit) {
            weiRebate = gasRefundLimit;
        }

//        CaskTreasury.refundGas(msg.sender, weiRebate);
    }


    /************************** ADMIN FUNCTIONS **************************/

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setParameters(
        uint256 _paymentFeeFixed,
        uint256 _paymentFeeRate,
        uint256 _gasRefundLimit
    ) external onlyOwner {
        paymentFeeFixed = _paymentFeeFixed;
        paymentFeeRate = _paymentFeeRate;
        gasRefundLimit = _gasRefundLimit;
    }

}