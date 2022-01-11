// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../interfaces/ICaskSubscriptionPlans.sol";

contract CaskSubscriptionPlans is
ICaskSubscriptionPlans,
Initializable,
OwnableUpgradeable,
PausableUpgradeable
{
    /** @dev Address of subscriptions protocol. */
    address public protocol;

    /** @dev Map for provider to profile info. */
    mapping(address => Provider) internal providerProfiles;

    /** @dev Maps for provider to plans. */
    mapping(address => bytes32[]) internal providerSubscriptionPlans; // provider => planId[]
    mapping(bytes32 => Plan) internal subscriptionPlans; // planId => Plan

    /** @dev Maps for discounts. */
    mapping(bytes32 => bytes32[]) internal subscriptionPlanDiscounts; // planId => discountHash[]
    mapping(bytes32 => mapping(bytes32 => Discount)) internal discounts; // planId => discountHash => Discount


    modifier onlyProvider(bytes32 _planId) {
        require(msg.sender == subscriptionPlans[_planId].provider, "!auth");
        _;
    }

    modifier onlyProtocol() {
        require(msg.sender == protocol, "!auth");
        _;
    }

    function initialize() public initializer {
        __Ownable_init();
        __Pausable_init();
    }
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}


    function setProtocol(address _protocol) external onlyOwner {
        protocol = _protocol;
    }

    function setProviderProfile(
        bytes32 _metaHash,
        uint8 _metaHF,
        uint8 _metaSize
    ) external override {
        Provider storage profile = providerProfiles[msg.sender];
        profile.metaHash = _metaHash;
        profile.metaHF = _metaHF;
        profile.metaSize = _metaSize;
    }

    function getProviderProfile(
        address _provider
    ) external override view returns(Provider memory) {
        return providerProfiles[_provider];
    }

    function createSubscriptionPlan(
        bytes32 _planCode,
        uint32 _period,
        uint256 _price,
        uint16 _freeTrialDays,
        bool _canPause,
        address _paymentAddress,
        bytes32 _metaHash,
        uint8 _metaHF,
        uint8 _metaSize
    ) external override {
        require(_period > 0, "!invalid(_period)");
        require(_price > 0, "!invalid(_price)");

        bytes32 planId = keccak256(abi.encodePacked(msg.sender, _planCode, block.number));

        providerSubscriptionPlans[msg.sender].push(planId);

        Plan storage plan = subscriptionPlans[planId];
        plan.provider = msg.sender;
        plan.planCode = _planCode;
        plan.period = _period;
        plan.price = _price;
        plan.freeTrialDays = _freeTrialDays;
        plan.canPause = _canPause;
        plan.paymentAddress = _paymentAddress;
        plan.metaHash = _metaHash;
        plan.metaHF = _metaHF;
        plan.metaSize = _metaSize;
        plan.status = PlanStatus.Enabled;

        emit SubscriptionPlanCreated(plan.provider, planId, plan.planCode);
    }

    function updateSubscriptionPlan(
        bytes32 _planId,
        uint32 _period,
        uint256 _price,
        uint16 _freeTrialDays,
        bool _canPause
    ) external override onlyProvider(_planId) {
        require(_period > 0, "!invalid(_period)");
        require(_price > 0, "!invalid(_price)");
        Plan storage plan = subscriptionPlans[_planId];
        require(plan.status == PlanStatus.Enabled, "!not_enabled");

        plan.period = _period;
        plan.price = _price;
        plan.freeTrialDays = _freeTrialDays;
        plan.canPause = _canPause;

        emit SubscriptionPlanUpdated(plan.provider, _planId, plan.planCode);
    }

    function setSubscriptionPlanDiscount(
        bytes32 _planId,
        bytes32 _discountId,
        uint8 _percent,
        uint32 _expiresAt,
        uint32 _maxUses
    ) external override onlyProvider(_planId) {
        require(_percent > 0, "!invalid(_percent)");
        Plan memory plan = subscriptionPlans[_planId];
        require(plan.status == PlanStatus.Enabled, "!not_enabled");

        Discount storage discount = discounts[_planId][_discountId];

        discount.percent = _percent;
        discount.expiresAt = _expiresAt;
        discount.maxUses = _maxUses;

        emit SubscriptionPlanSetDiscount(plan.provider, _planId, plan.planCode, _discountId);
    }

    function consumeDiscount(
        bytes32 _planId,
        bytes32 _discountId
    ) external override onlyProtocol returns(bool) {
        Discount storage discount = discounts[_planId][_discountId];
        require(discount.maxUses == 0 || discount.uses < discount.maxUses, "!exhausted");
        discount.uses = discount.uses - 1;
        return discount.maxUses == 0 || discount.uses < discount.maxUses;
    }

    function disableSubscriptionPlan(
        bytes32 _planId
    ) external override onlyProvider(_planId) {
        Plan storage plan = subscriptionPlans[_planId];
        require(plan.status == PlanStatus.Enabled, "!not_enabled");

        plan.status = PlanStatus.Disabled;

        emit SubscriptionPlanDisabled(plan.provider, _planId, plan.planCode);
    }

    function enableSubscriptionPlan(
        bytes32 _planId
    ) external override onlyProvider(_planId) {
        Plan storage plan = subscriptionPlans[_planId];
        require(plan.status == PlanStatus.Disabled, "!not_disabled");

        plan.status = PlanStatus.Enabled;

        emit SubscriptionPlanEnabled(plan.provider, _planId, plan.planCode);
    }

    function eolSubscriptionPlan(
        bytes32 _planId
    ) external override onlyProvider(_planId) {
        Plan storage plan = subscriptionPlans[_planId];
        require(plan.status != PlanStatus.EndOfLife, "!already_eol");

        plan.status = PlanStatus.EndOfLife;

        emit SubscriptionPlanEOL(plan.provider, _planId, plan.planCode);
    }

    function verifyDiscount(
        bytes32 _planId,
        bytes32 _discountProof
    ) external override view returns(bytes32) {
        bytes32 discountHash = keccak256(abi.encodePacked(_discountProof));
        Discount memory discount = discounts[_planId][discountHash];
        if (discount.percent > 0 && discount.expiresAt < uint32(block.timestamp)) {
            return discountHash;
        }
        return 0; // no discount
    }

    function getSubscriptionPlans(
        address _provider
    ) external override view returns(bytes32[] memory) {
        return providerSubscriptionPlans[_provider];
    }

    function getSubscriptionPlan(
        bytes32 _planId
    ) external override view returns(Plan memory) {
        return subscriptionPlans[_planId];
    }

    function getSubscriptionPlanDiscount(
        bytes32 _planId,
        bytes32 _discountId
    ) external override view returns(Discount memory) {
        return discounts[_planId][_discountId];
    }

    function getSubscriptionPlanDiscounts(
        bytes32 _planId
    ) external override view returns(bytes32[] memory) {
        return subscriptionPlanDiscounts[_planId];
    }

}