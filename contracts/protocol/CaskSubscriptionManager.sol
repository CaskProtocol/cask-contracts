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


    modifier onlySubscriptions() {
        require(msg.sender == address(subscriptions), "!AUTH");
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
        bytes2 options = bytes2(_planData << 240);
        return ICaskSubscriptions.PlanInfo({
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
            maxUses: uint32(bytes4(_discountData << 160)),
            planId: uint32(bytes4(_discountData << 192)),
            //reserved: uint16(bytes2(_discountData << 208)),
            isFixed: options & 0x0001 == 0x0001
        });
    }

    function processSinglePayment(
        address _consumer,
        address _provider,
        uint256 _subscriptionId,
        uint256 _amount
    ) external onlySubscriptions {
        _processPayment(_consumer, _provider, _subscriptionId, _amount);
    }

    function _processPayment(
        address _consumer,
        address _provider,
        uint256 _subscriptionId,
        uint256 _amount
    ) internal {
        require(vault.currentValueOf(_consumer) >= _amount, "!BALANCE");

        // TODO: reduce fee based on staked balance
        //        uint256 stakedBalance = ICaskStakeManager(stakeManager).providerStakeBalanceOf(_provider);
        uint256 stakedBalance = 0;
        uint256 paymentFeeRateAdjusted;

        ICaskSubscriptions.Subscription memory subscription = subscriptions.getSubscription(_subscriptionId);
        ICaskSubscriptions.PlanInfo memory planData = _parsePlanData(subscription.planData);

        uint256 activeCount = subscriptions.getProviderActiveSubscriptionCount(subscription.provider);

        if (stakedBalance > 0) {
            uint256 loadFactor = 365 / (planData.period / 1 days);
            uint256 noFeeTarget = activeCount * stakeTargetFactor * loadFactor;

            paymentFeeRateAdjusted = paymentFeeRateMax - (paymentFeeRateMax * (stakedBalance / noFeeTarget));
            if (paymentFeeRateAdjusted < paymentFeeRateMin) {
                paymentFeeRateAdjusted = paymentFeeRateMin;
            }
        } else {
            paymentFeeRateAdjusted = paymentFeeRateMax;
        }

        ICaskSubscriptionPlans.Provider memory providerProfile = subscriptionPlans.getProviderProfile(_provider);

        address paymentAddress = _provider;
        if (providerProfile.paymentAddress != address(0)) {
            paymentAddress = providerProfile.paymentAddress;
        }

        // TODO: handle network fee

        uint256 fee = paymentFeeFixed + (_amount * paymentFeeRateAdjusted / 10000);
        vault.protocolPayment(_consumer, paymentAddress, _amount, fee);
    }

    function rebateGas(
        uint256 _initialGasLeft,
        uint256 _gasRefundLimit
    ) external onlySubscriptions {
        if (_gasRefundLimit == 0) {
            return;
        }

        // assume a fixed 30000 wei for transaction overhead and stuff performed after this snapshot
        uint256 weiRebate = (_initialGasLeft - gasleft() + 30000) * tx.gasprice;
        if (weiRebate > _gasRefundLimit) {
            weiRebate = _gasRefundLimit;
        }

        //        ICaskTreasury(caskTreasury).refundGas(msg.sender, weiRebate);
    }

    function checkUpkeep(
        bytes calldata checkData
    ) external view override returns(bool upkeepNeeded, bytes memory performData) {
        (
        uint256 limit,
        uint256 offset
        ) = abi.decode(checkData, (uint256, uint256));

        (
        uint256 renewableCount,
        uint256[] memory subscriptionIds
        ) = _subscriptionsRenewable(limit, offset);

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
                    j = j + 1;
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
        uint256 _offset
    ) internal view returns(uint256, uint256[] memory) {

        uint256 allSubscriptionCount = subscriptions.getAllSubscriptionsCount();

        uint256 size = _limit;
        if (size > allSubscriptionCount) {
            size = allSubscriptionCount;
        }

        uint32 timestamp = uint32(block.timestamp);

        uint256[] memory renewables = new uint256[](size);
        uint256[] memory allSubscriptions = subscriptions.getAllSubscriptions();

        uint256 renewableCount = 0;
        for (uint256 i = _offset; i < allSubscriptionCount; i++) {
            ICaskSubscriptions.Subscription memory subscription = subscriptions.getSubscription(allSubscriptions[i]);
            if (subscription.renewAt <= timestamp &&
                subscription.status != ICaskSubscriptions.SubscriptionStatus.Canceled &&
                subscription.status != ICaskSubscriptions.SubscriptionStatus.Paused)
            {
                renewables[renewableCount] = allSubscriptions[i];
                renewableCount = renewableCount + 1;
                if (renewableCount >= size) {
                    break;
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
        ICaskSubscriptions.Subscription memory subscription = subscriptions.getSubscription(_subscriptionId);

        uint32 timestamp = uint32(block.timestamp);

        // not time to renew yet or is paused
        if (subscription.renewAt > timestamp ||
            subscription.status == ICaskSubscriptions.SubscriptionStatus.Paused) {
            return;
        }

        // subscription scheduled to be canceled by consumer or has hit its cancelAt time
        if (subscription.status == ICaskSubscriptions.SubscriptionStatus.PendingCancel ||
            (subscription.cancelAt > 0 && subscription.cancelAt <= timestamp) ||
            (subscriptionPlans.getPlanStatus(subscription.provider, subscription.planId) ==
                ICaskSubscriptionPlans.PlanStatus.EndOfLife &&
                subscriptionPlans.getPlanEOL(subscription.provider, subscription.planId) <= timestamp))
        {
            subscriptions.managerCancelSubscription(_subscriptionId);
            return;
        }

        // if a plan change is pending, switch to use new plan info
        if (subscriptions.getPendingPlanChange(_subscriptionId) > 0) {
            subscriptions.managerPlanChange(_subscriptionId);
            subscription = subscriptions.getSubscription(_subscriptionId); // refresh
        }


        uint256 chargeAmount = _planDataPrice(subscription.planData);

        // maybe apply discount
        if (subscription.discountId > 0) {
            ICaskSubscriptionPlans.Discount memory discountInfo = _parseDiscountData(subscription.discountData);

            try subscriptionPlans.consumeDiscount(subscription.provider, discountInfo.planId,
                subscription.discountId, subscription.discountData) returns (bool stillValid)
            {
                if (discountInfo.isFixed) {
                    chargeAmount = chargeAmount - discountInfo.value;
                } else {
                    chargeAmount = chargeAmount - (chargeAmount * discountInfo.value / 10000);
                }

                if (!stillValid) {
                    subscriptions.managerClearDiscount(_subscriptionId);
                }
            } catch Error(string memory) {
                subscriptions.managerClearDiscount(_subscriptionId);
            }
        }

        // consumer does not have enough balance to cover payment
        if (chargeAmount > 0 && vault.currentValueOf(subscriptions.ownerOf(_subscriptionId)) < chargeAmount) {
            // if have not been able to renew for 7 days, cancel subscription
            if (subscription.renewAt < timestamp - 7 days) {
                subscriptions.managerCancelSubscription(_subscriptionId);
            } else if (subscription.status != ICaskSubscriptions.SubscriptionStatus.PastDue) {
                subscriptions.managerPastDueSubscription(_subscriptionId);
            }

        } else if (chargeAmount > 0) {
            _processPayment(subscriptions.ownerOf(_subscriptionId), subscription.provider, _subscriptionId, chargeAmount);
            subscriptions.managerRenewSubscription(_subscriptionId);

        } else { // no charge, move along now
            subscriptions.managerRenewSubscription(_subscriptionId);
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