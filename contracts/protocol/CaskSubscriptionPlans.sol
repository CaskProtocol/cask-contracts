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
    mapping(address => bytes32[]) internal providerPlans; // provider => planId[]
    mapping(bytes32 => Plan) internal plans; // planId => Plan

    /** @dev Maps for discounts. */
    mapping(bytes32 => bytes32[]) internal planDiscounts; // planId => discountHash[]
    mapping(bytes32 => mapping(bytes32 => Discount)) internal discounts; // planId => discountHash => Discount


    modifier onlyProvider(bytes32 _planId) {
        require(msg.sender == plans[_planId].provider, "!AUTH");
        _;
    }

    modifier onlyProtocol() {
        require(msg.sender == protocol, "!AUTH");
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

    function createPlan(
        bytes32 _planCode,
        uint32 _period,
        uint256 _price,
        uint32 _minTerm,
        uint32 _freeTrial,
        bool _canPause,
        address _paymentAddress,
        bytes32 _metaHash,
        uint8 _metaHF,
        uint8 _metaSize
    ) external override {
        require(_period > 0, "!INVALID(_period)");
        require(_price > 0, "!INVALID(_price)");

        bytes32 planId = keccak256(abi.encodePacked(msg.sender, _planCode, block.number));

        providerPlans[msg.sender].push(planId);

        Plan storage plan = plans[planId];
        plan.provider = msg.sender;
        plan.planCode = _planCode;
        plan.period = _period;
        plan.price = _price;
        plan.minTerm = _minTerm;
        plan.freeTrial = _freeTrial;
        plan.canPause = _canPause;
        plan.paymentAddress = _paymentAddress;
        plan.metaHash = _metaHash;
        plan.metaHF = _metaHF;
        plan.metaSize = _metaSize;
        plan.status = PlanStatus.Enabled;

        emit PlanCreated(plan.provider, planId, plan.planCode);
    }

    function updatePlan(
        bytes32 _planId,
        uint256 _price,
        uint32 _minTerm,
        uint32 _freeTrial,
        bool _canPause
    ) external override onlyProvider(_planId) {
        require(_price > 0, "!INVALID(_price)");
        Plan storage plan = plans[_planId];
        require(plan.status == PlanStatus.Enabled, "!NOT_ENABLED");

        plan.price = _price;
        plan.minTerm = _minTerm;
        plan.freeTrial = _freeTrial;
        plan.canPause = _canPause;

        emit PlanUpdated(plan.provider, _planId, plan.planCode);
    }

    function setPlanDiscount(
        bytes32 _planId,
        bytes32 _discountId,
        uint16 _percent,
        uint32 _expiresAt,
        uint32 _maxUses
    ) external override onlyProvider(_planId) {
        require(_percent > 0, "!INVALID(_percent)");
        Plan memory plan = plans[_planId];
        require(plan.status == PlanStatus.Enabled, "!NOT_ENABLED");

        Discount storage discount = discounts[_planId][_discountId];

        discount.percent = _percent;
        discount.expiresAt = _expiresAt;
        discount.maxUses = _maxUses;

        emit PlanSetDiscount(plan.provider, _planId, plan.planCode, _discountId);
    }

    function updatePlanMeta(
        bytes32 _planId,
        bytes32 _metaHash,
        uint8 _metaHF,
        uint8 _metaSize
    ) external override onlyProvider(_planId) {
        Plan storage plan = plans[_planId];
        require(plan.status == PlanStatus.Enabled, "!NOT_ENABLED");

        plan.metaHash = _metaHash;
        plan.metaHF = _metaHF;
        plan.metaSize = _metaSize;

        emit PlanUpdatedMeta(plan.provider, _planId, plan.planCode, _metaHash, _metaHF, _metaSize);
    }

    function consumeDiscount(
        bytes32 _planId,
        bytes32 _discountId
    ) external override onlyProtocol returns(bool) {
        Discount storage discount = discounts[_planId][_discountId];
        require(discount.maxUses == 0 || discount.uses < discount.maxUses, "!DISCOUNT_MAX_USES");
        require(discount.validAfter == 0 || discount.validAfter >= uint32(block.timestamp), "!DISCOUNT_NOT_VALID_YET");
        require(discount.expiresAt == 0 || discount.expiresAt < uint32(block.timestamp), "!DISCOUNT_EXPIRED");

        discount.uses = discount.uses + 1;
        return discount.maxUses == 0 || discount.uses < discount.maxUses;
    }

    function disablePlan(
        bytes32 _planId
    ) external override onlyProvider(_planId) {
        Plan storage plan = plans[_planId];
        require(plan.status == PlanStatus.Enabled, "!NOT_ENABLED");

        plan.status = PlanStatus.Disabled;

        emit PlanDisabled(plan.provider, _planId, plan.planCode);
    }

    function enablePlan(
        bytes32 _planId
    ) external override onlyProvider(_planId) {
        Plan storage plan = plans[_planId];
        require(plan.status == PlanStatus.Disabled, "!NOT_DISABLED");

        plan.status = PlanStatus.Enabled;

        emit PlanEnabled(plan.provider, _planId, plan.planCode);
    }

    function killPlan(
        bytes32 _planId
    ) external override onlyProvider(_planId) {
        Plan storage plan = plans[_planId];
        require(plan.status != PlanStatus.EndOfLife, "!ALREADY_EOL");

        plan.status = PlanStatus.EndOfLife;

        emit PlanKilled(plan.provider, _planId, plan.planCode);
    }

    function verifyDiscount(
        bytes32 _planId,
        bytes32 _discountProof
    ) external override view returns(bytes32) {
        bytes32 discountHash = keccak256(abi.encode(_discountProof));
        Discount memory discount = discounts[_planId][discountHash];
        if (discount.percent > 0 && // needed to make sure we didnt find a zeroed out non existant discount
            (discount.maxUses == 0 || discount.uses < discount.maxUses) &&
            (discount.validAfter == 0 || discount.validAfter >= uint32(block.timestamp)) &&
            (discount.expiresAt == 0 || discount.expiresAt < uint32(block.timestamp)))
        {
            return discountHash;
        }
        return 0; // no discount
    }

    function getPlans(
        address _provider
    ) external override view returns(bytes32[] memory) {
        return providerPlans[_provider];
    }

    function getPlan(
        bytes32 _planId
    ) external override view returns(Plan memory) {
        return plans[_planId];
    }

    function getPlanDiscount(
        bytes32 _planId,
        bytes32 _discountId
    ) external override view returns(Discount memory) {
        return discounts[_planId][_discountId];
    }

    function getPlanDiscounts(
        bytes32 _planId
    ) external override view returns(bytes32[] memory) {
        return planDiscounts[_planId];
    }

}