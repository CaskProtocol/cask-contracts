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

    /** @dev map used to track when to reattempt a failed payment */
    mapping(uint256 => uint32) private attemptAfter; // subscriptionId => timestamp


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
            uint256 noFeeTarget = subscriptions.getProviderActiveSubscriptionCount(subscription.provider) *
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

    function checkUpkeep(
        bytes calldata checkData
    ) external view override returns(bool upkeepNeeded, bytes memory performData) {
        (
        uint256 limit,
        uint256 offset,
        uint8 checkType
        ) = abi.decode(checkData, (uint256, uint256, uint8));

        (
        uint256 renewableCount,
        uint256[] memory subscriptionIds
        ) = _subscriptionsRenewable(limit, offset, checkType);

        if (renewableCount == 0) {
            upkeepNeeded = false;
            performData = bytes("");
        } else if (renewableCount < limit) {
            // convert array of `limit` length to new array sized to hold only renewing subscriptionIds
            uint256 j = 0;
            uint256[] memory renewables = new uint256[](renewableCount);
            for (uint256 i = 0; i < limit && j < renewableCount; i++) {
                if (subscriptionIds[i] > 0) {
                    renewables[j] = subscriptionIds[i];
                    j += 1;
                }
            }
            upkeepNeeded = true;
            performData = abi.encode(renewables);

        } else {
            upkeepNeeded = true;
            performData = abi.encode(subscriptionIds);
        }
    }

    function _subscriptionsRenewable(
        uint256 _limit,
        uint256 _offset,
        uint8 _checkType
    ) internal view returns(uint256, uint256[] memory) {

        uint256 activeSubscriptionCount = subscriptions.getActiveSubscriptionsCount();

        uint256 size = _limit;
        if (size > activeSubscriptionCount) {
            size = activeSubscriptionCount;
        }
        if (_offset >= activeSubscriptionCount) {
            return (0,new uint256[](0));
        }

        uint32 timestamp = uint32(block.timestamp);

        uint256[] memory renewables = new uint256[](size);
        uint256[] memory activeSubscriptions = subscriptions.getActiveSubscriptions();

        uint256 renewableCount = 0;
        for (uint256 i = 0; renewableCount < size && i + _offset < activeSubscriptionCount; i++) {
            (ICaskSubscriptions.Subscription memory subscription,) =
                subscriptions.getSubscription(activeSubscriptions[i+_offset]);

            if (subscription.renewAt <= timestamp) {
                if (_checkType == 0) { // active
                    if (subscription.status == ICaskSubscriptions.SubscriptionStatus.Active) {
                        renewables[renewableCount] = activeSubscriptions[i+_offset];
                        renewableCount += 1;
                    }
                } else if (_checkType == 1) { // trial ending
                    if (subscription.status == ICaskSubscriptions.SubscriptionStatus.Trialing) {
                        renewables[renewableCount] = activeSubscriptions[i+_offset];
                        renewableCount += 1;
                    }
                } else if (_checkType == 2) { // past due
                    if (subscription.status == ICaskSubscriptions.SubscriptionStatus.PastDue &&
                        attemptAfter[activeSubscriptions[i+_offset]] <= timestamp)
                    {
                        renewables[renewableCount] = activeSubscriptions[i+_offset];
                        renewableCount += 1;
                    }
                }
            }
        }
        return (renewableCount, renewables);
    }

    function performUpkeep(
        bytes calldata performData
    ) external override whenNotPaused {
        uint256[] memory subscriptionIds = abi.decode(performData, (uint256[]));
        for (uint256 i = 0; i < subscriptionIds.length; i++) {
            if (subscriptionIds[i] > 0) {
                _renewSubscription(subscriptionIds[i]);
            }
        }
    }

    function renewSubscription(
        uint256 _subscriptionId
    ) external override whenNotPaused {
        _renewSubscription(_subscriptionId);
    }

    function _renewSubscription(
        uint256 _subscriptionId
    ) internal {
        (ICaskSubscriptions.Subscription memory subscription,) = subscriptions.getSubscription(_subscriptionId);

        uint32 timestamp = uint32(block.timestamp);

        // not time to renew yet or is paused
        if (subscription.renewAt > timestamp ||
            subscription.status == ICaskSubscriptions.SubscriptionStatus.Paused) {
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
        if (chargePrice > 0 && vault.currentValueOf(subscriptions.ownerOf(_subscriptionId)) < chargePrice) {
            // if have not been able to renew for up to `gracePeriod` days, cancel subscription
            if (subscription.renewAt < timestamp - (planInfo.gracePeriod * 1 days)) {
                subscriptions.managerCommand(_subscriptionId, ICaskSubscriptions.ManagerCommand.Cancel);
            } else if (subscription.status != ICaskSubscriptions.SubscriptionStatus.PastDue) {
                attemptAfter[_subscriptionId] = timestamp + 4 hours;
                subscriptions.managerCommand(_subscriptionId, ICaskSubscriptions.ManagerCommand.PastDue);
            }

        } else if (chargePrice > 0) {
            _processPayment(subscriptions.ownerOf(_subscriptionId), subscription.provider, _subscriptionId, chargePrice);
            delete attemptAfter[_subscriptionId]; // clear if successful payment
            subscriptions.managerCommand(_subscriptionId, ICaskSubscriptions.ManagerCommand.Renew);

        } else { // no charge, move along now
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
        uint256 _stakeTargetFactor
    ) external onlyOwner {
        paymentFeeFixed = _paymentFeeFixed;
        paymentFeeRateMin = _paymentFeeRateMin;
        paymentFeeRateMax = _paymentFeeRateMax;
        stakeTargetFactor = _stakeTargetFactor;
    }

}