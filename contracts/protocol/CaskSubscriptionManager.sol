// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

import "../interfaces/ICaskSubscriptionManager.sol";
import "../interfaces/ICaskSubscriptionPlans.sol";
import "../interfaces/ICaskSubscriptions.sol";
import "../interfaces/ICaskVault.sol";

contract CaskSubscriptionManager is
ICaskSubscriptionManager,
Initializable,
OwnableUpgradeable,
PausableUpgradeable,
KeeperCompatibleInterface
{

    /************************** PARAMETERS **************************/

    /** @dev contract to manage subscription plan definitions. */
    ICaskSubscriptionPlans public subscriptionPlans;
    ICaskSubscriptions public subscriptions;

    /** @dev vault to use for payments. */
    ICaskVault public vault;

    /** @dev fixed fee to charge on payments, in baseAsset decimal units. */
    uint256 public paymentFeeFixed;

    /** @dev min and max percentage to charge on payments, in bps. 50% = 5000. */
    uint256 public paymentFeeRateMin; // floor if full discount applied
    uint256 public paymentFeeRateMax; // fee if no discount applied

    /** @dev factor used to reduce payment fee based on qty of staked CASK */
    uint256 public stakeTargetFactor;

    /** @dev size (in seconds) of buckets to group subscriptions into for processing */
    uint32 public processBucketSize;

    /** @dev map used to track when subscriptions need attention next */
    mapping(CheckType => mapping(uint32 => uint256[])) private processQueue; // renewal bucket => subscriptionId[]
    mapping(CheckType => uint32) private processingBucket; // current bucket being processed


    modifier onlySubscriptions() {
        require(_msgSender() == address(subscriptions), "!AUTH");
        _;
    }

    function initialize(
        address _vault,
        address _subscriptionPlans,
        address _subscriptions
    ) public initializer {
        __Ownable_init();
        __Pausable_init();

        subscriptionPlans = ICaskSubscriptionPlans(_subscriptionPlans);
        subscriptions = ICaskSubscriptions(_subscriptions);
        vault = ICaskVault(_vault);

        // parameter defaults
        paymentFeeFixed = 0;
        paymentFeeRateMin = 0;
        paymentFeeRateMax = 0;
        stakeTargetFactor = 0;
        processBucketSize = 300;

        processingBucket[CheckType.Active] = _currentBucket();
        processingBucket[CheckType.PastDue] = _currentBucket();
    }
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function _parsePlanData(
        bytes32 _planData
    ) internal pure returns(ICaskSubscriptions.PlanInfo memory) {
        bytes1 options = bytes1(_planData << 248);
        return ICaskSubscriptions.PlanInfo({
        price: uint256(_planData >> 160),
        planId: uint32(bytes4(_planData << 96)),
        period: uint32(bytes4(_planData << 128)),
        freeTrial: uint32(bytes4(_planData << 160)),
        maxActive: uint32(bytes4(_planData << 192)),
        minPeriods: uint16(bytes2(_planData << 224)),
        gracePeriod: uint8(bytes1(_planData << 240)),
        canPause: options & 0x01 == 0x01,
        canTransfer: options & 0x02 == 0x02
        });
    }

    function _planDataPrice(
        bytes32 _planData
    ) internal pure returns(uint256) {
        return uint256(_planData >> 160);
    }

    function _parseNetworkData(
        bytes32 _networkData
    ) internal pure returns(ICaskSubscriptions.NetworkInfo memory) {
        return ICaskSubscriptions.NetworkInfo({
            network: address(bytes20(_networkData)),
            feeBps: uint16(bytes2(_networkData << 160))
        });
    }

    function _parseDiscountData(
        bytes32 _discountData
    ) internal pure returns(ICaskSubscriptionPlans.Discount memory) {
        bytes2 options = bytes2(_discountData << 240);
        return ICaskSubscriptionPlans.Discount({
            value: uint256(_discountData >> 160),
            validAfter: uint32(bytes4(_discountData << 96)),
            expiresAt: uint32(bytes4(_discountData << 128)),
            maxRedemptions: uint32(bytes4(_discountData << 160)),
            planId: uint32(bytes4(_discountData << 192)),
            applyPeriods: uint16(bytes2(_discountData << 224)),
            isFixed: options & 0x0001 == 0x0001
        });
    }

    function processSinglePayment(
        address _consumer,
        address _provider,
        uint256 _subscriptionId,
        uint256 _value
    ) external onlySubscriptions {
        _processPayment(_consumer, _provider, _subscriptionId, _value);
    }

    function _processPayment(
        address _consumer,
        address _provider,
        uint256 _subscriptionId,
        uint256 _value
    ) internal {
        require(vault.currentValueOf(_consumer) >= _value, "!BALANCE");

        // TODO: reduce fee based on staked balance
        //        uint256 stakedBalance = ICaskStakeManager(stakeManager).providerStakeBalanceOf(_provider);
        uint256 stakedBalance = 0;
        uint256 paymentFeeRateAdjusted = paymentFeeRateMax;

        (ICaskSubscriptions.Subscription memory subscription,) = subscriptions.getSubscription(_subscriptionId);
        ICaskSubscriptions.PlanInfo memory planData = _parsePlanData(subscription.planData);

        if (stakedBalance > 0) {
            uint256 loadFactor = 365 / (planData.period / 1 days);
            uint256 noFeeTarget = subscriptions.getProviderSubscriptionCount(subscription.provider, false, 0) *
                    stakeTargetFactor * loadFactor;

            paymentFeeRateAdjusted = paymentFeeRateMax - (paymentFeeRateMax * (stakedBalance / noFeeTarget));
            if (paymentFeeRateAdjusted < paymentFeeRateMin) {
                paymentFeeRateAdjusted = paymentFeeRateMin;
            }
        }

        ICaskSubscriptionPlans.Provider memory providerProfile = subscriptionPlans.getProviderProfile(_provider);

        address paymentAddress = _provider;
        if (providerProfile.paymentAddress != address(0)) {
            paymentAddress = providerProfile.paymentAddress;
        }

        _sendPayment(subscription, _consumer, paymentAddress, _value, paymentFeeRateAdjusted);
    }

    function _sendPayment(
        ICaskSubscriptions.Subscription memory _subscription,
        address _consumer,
        address _paymentAddress,
        uint256 _value,
        uint256 _protocolFeeBps
    ) internal {
        if (_subscription.networkData > 0) {
            ICaskSubscriptions.NetworkInfo memory networkData = _parseNetworkData(_subscription.networkData);
            vault.protocolPayment(_consumer, _paymentAddress, _value,
                paymentFeeFixed + (_value * _protocolFeeBps / 10000),
                networkData.network, _value * networkData.feeBps / 10000);
        } else {
            vault.protocolPayment(_consumer, _paymentAddress, _value,
                paymentFeeFixed + (_value * _protocolFeeBps / 10000));
        }
    }

    function _bucketAt(
        uint32 _timestamp
    ) internal view returns(uint32) {
        return _timestamp - (_timestamp % processBucketSize) + processBucketSize;
    }

    function _currentBucket() internal view returns(uint32) {
        uint32 timestamp = uint32(block.timestamp);
        return timestamp - (timestamp % processBucketSize);
    }

    function queueItem(
        CheckType _checkType,
        uint32 _bucket,
        uint256 _idx
    ) external view returns(uint256) {
        return processQueue[_checkType][_bucket][_idx];
    }

    function queueSize(
        CheckType _checkType,
        uint32 _bucket
    ) external view returns(uint256) {
        return processQueue[_checkType][_bucket].length;
    }

    function queuePosition(
        CheckType _checkType
    ) external view returns(uint32) {
        return processingBucket[_checkType];
    }

    function checkUpkeep(
        bytes calldata checkData
    ) external view override returns(bool upkeepNeeded, bytes memory performData) {
        (
        uint256 limit,
        uint256 minDepth,
        CheckType checkType
        ) = abi.decode(checkData, (uint256, uint256, CheckType));

        uint32 currentBucket = _currentBucket();
        upkeepNeeded = false;

        uint32 checkBucket = processingBucket[checkType];
        if (checkBucket == 0) {
            checkBucket = currentBucket;
        }

        // if queue is more than an hour old, all hands on deck
        if (currentBucket >= checkBucket && currentBucket - checkBucket > 1 hours) {
            upkeepNeeded = true;
        } else {
            while (checkBucket <= currentBucket) {
                if (processQueue[checkType][checkBucket].length > 0 &&
                    processQueue[checkType][checkBucket].length >= minDepth)
                {
                    upkeepNeeded = true;
                    break;
                }
                checkBucket += processBucketSize;
            }
        }

        performData = abi.encode(limit, processQueue[checkType][checkBucket].length, checkType);
    }


    function performUpkeep(
        bytes calldata performData
    ) external override whenNotPaused {
        (
        uint256 limit,
        uint256 depth,
        CheckType checkType
        ) = abi.decode(performData, (uint256, uint256, CheckType));

        uint32 currentBucket = _currentBucket();
        uint256 renewals = 0;
        uint256 maxBucketChecks = limit * 5;

        if (processingBucket[checkType] == 0) {
            processingBucket[checkType] = currentBucket;
        }

        while (renewals < limit && maxBucketChecks > 0 && processingBucket[checkType] <= currentBucket) {
            uint256 queueLen = processQueue[checkType][processingBucket[checkType]].length;
            if (queueLen > 0) {
                uint256 subscriptionId = processQueue[checkType][processingBucket[checkType]][queueLen-1];
                processQueue[checkType][processingBucket[checkType]].pop();
                _renewSubscription(subscriptionId);
                renewals += 1;
            } else {
                if (processingBucket[checkType] < currentBucket) {
                    processingBucket[checkType] += processBucketSize;
                    maxBucketChecks -= 1;
                } else {
                    break; // nothing left to do
                }
            }
        }

        emit SubscriptionManagerReport(limit, renewals, depth, checkType,
            processQueue[checkType][processingBucket[checkType]].length, processingBucket[checkType]);
    }

    function renewSubscription(
        uint256 _subscriptionId
    ) external override whenNotPaused {
        _renewSubscription(_subscriptionId);
    }

    function _renewSubscription(
        uint256 _subscriptionId
    ) internal {
        (
        ICaskSubscriptions.Subscription memory subscription,
        address consumer
        ) = subscriptions.getSubscription(_subscriptionId);

        uint32 timestamp = uint32(block.timestamp);

        // will be re-queued when resumed
        if (subscription.status == ICaskSubscriptions.SubscriptionStatus.Paused) {
            return;
        }

        // not time to renew yet, re-queue for renewal time
        if (subscription.renewAt > timestamp) {
            processQueue[CheckType.Active][_bucketAt(subscription.renewAt)].push(_subscriptionId);
            return;
        }

        // subscription scheduled to be canceled by consumer or has hit its cancelAt time
        if ((subscription.cancelAt > 0 && subscription.cancelAt <= timestamp) ||
            (subscriptionPlans.getPlanStatus(subscription.provider, subscription.planId) ==
                ICaskSubscriptionPlans.PlanStatus.EndOfLife &&
                subscriptionPlans.getPlanEOL(subscription.provider, subscription.planId) <= timestamp))
        {
            subscriptions.managerCommand(_subscriptionId, ICaskSubscriptions.ManagerCommand.Cancel);
            return;
        }

        // if a plan change is pending, switch to use new plan info
        if (subscriptions.getPendingPlanChange(_subscriptionId) > 0) {
            subscriptions.managerCommand(_subscriptionId, ICaskSubscriptions.ManagerCommand.PlanChange);
            (subscription,) = subscriptions.getSubscription(_subscriptionId); // refresh
        }

        ICaskSubscriptions.PlanInfo memory planInfo = _parsePlanData(subscription.planData);
        uint256 chargePrice = planInfo.price;

        // maybe apply discount
        if (subscription.discountId > 0) {
            ICaskSubscriptionPlans.Discount memory discountInfo = _parseDiscountData(subscription.discountData);

            if(discountInfo.applyPeriods == 0 || subscription.createdAt +
                (planInfo.period * discountInfo.applyPeriods) < timestamp)
            {
                if (discountInfo.isFixed) {
                    chargePrice = chargePrice - discountInfo.value;
                } else {
                    chargePrice = chargePrice - (chargePrice * discountInfo.value / 10000);
                }
            } else {
                subscriptions.managerCommand(_subscriptionId, ICaskSubscriptions.ManagerCommand.ClearDiscount);
            }
        }

        // consumer does not have enough balance to cover payment
        if (chargePrice > 0 && vault.currentValueOf(consumer) < chargePrice) {
            // if have not been able to renew for up to `gracePeriod` days, cancel subscription
            if (subscription.renewAt < timestamp - (planInfo.gracePeriod * 1 days)) {
                subscriptions.managerCommand(_subscriptionId, ICaskSubscriptions.ManagerCommand.Cancel);
            } else if (subscription.status != ICaskSubscriptions.SubscriptionStatus.PastDue) {
                processQueue[CheckType.PastDue][_bucketAt(timestamp + 4 hours)].push(_subscriptionId);
                subscriptions.managerCommand(_subscriptionId, ICaskSubscriptions.ManagerCommand.PastDue);
            } else {
                processQueue[CheckType.PastDue][_bucketAt(timestamp + 4 hours)].push(_subscriptionId);
            }

        } else if (chargePrice > 0) {
            _processPayment(consumer, subscription.provider, _subscriptionId, chargePrice);

            if (subscription.renewAt + planInfo.period < timestamp) {
                // subscription is still behind, put in next queue bucket
                processQueue[CheckType.PastDue][_bucketAt(timestamp)].push(_subscriptionId);
            } else {
                processQueue[CheckType.Active][_bucketAt(subscription.renewAt + planInfo.period)].push(_subscriptionId);
            }

            subscriptions.managerCommand(_subscriptionId, ICaskSubscriptions.ManagerCommand.Renew);

        } else { // no charge, move along now
            processQueue[CheckType.Active][_bucketAt(subscription.renewAt + planInfo.period)].push(_subscriptionId);
            subscriptions.managerCommand(_subscriptionId, ICaskSubscriptions.ManagerCommand.Renew);
        }

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
        uint256 _paymentFeeRateMin,
        uint256 _paymentFeeRateMax,
        uint256 _stakeTargetFactor,
        uint32 _processBucketSize
    ) external onlyOwner {
        paymentFeeFixed = _paymentFeeFixed;
        paymentFeeRateMin = _paymentFeeRateMin;
        paymentFeeRateMax = _paymentFeeRateMax;
        stakeTargetFactor = _stakeTargetFactor;
        processBucketSize = _processBucketSize;

        // re-map to new bucket size
        processingBucket[CheckType.Active] = _bucketAt(processingBucket[CheckType.Active]);
        processingBucket[CheckType.PastDue] = _bucketAt(processingBucket[CheckType.PastDue]);
    }

    function setProcessingBucket(
        CheckType _checkType,
        uint32 _timestamp
    ) external onlyOwner {
        processingBucket[_checkType] = _bucketAt(_timestamp);
    }

}