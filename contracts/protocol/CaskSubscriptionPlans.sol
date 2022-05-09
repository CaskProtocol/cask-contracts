// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@opengsn/contracts/src/BaseRelayRecipient.sol";


import "../interfaces/ICaskSubscriptionPlans.sol";
import "../interfaces/ICaskPrivateBeta.sol";

contract CaskSubscriptionPlans is
ICaskSubscriptionPlans,
BaseRelayRecipient,
OwnableUpgradeable,
PausableUpgradeable
{
    /** @dev Address of subscription manager. */
    address public subscriptionManager;

    /** @dev Map for provider to profile info. */
    mapping(address => Provider) internal providerProfiles;

    /** @dev Map for current plan status. */
    // provider->planId => Plan
    mapping(address => mapping(uint32 => PlanStatus)) internal planStatus;
    mapping(address => mapping(uint32 => uint32)) internal planEol;

    /** @dev Maps for discounts. */
    mapping(address => mapping(uint32 => mapping(bytes32 => uint256))) internal discountRedemptions;

    ICaskPrivateBeta public privateBeta;
    bool public privateBetaOnly;


    modifier onlyManager() {
        require(_msgSender() == subscriptionManager, "!AUTH");
        _;
    }

    function initialize() public initializer {
        __Ownable_init();
        __Pausable_init();

        privateBetaOnly = false;
    }
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function versionRecipient() public pure override returns(string memory) { return "2.2.0"; }

    function _msgSender() internal view override(ContextUpgradeable, BaseRelayRecipient)
    returns (address sender) {
        sender = BaseRelayRecipient._msgSender();
    }

    function _msgData() internal view override(ContextUpgradeable, BaseRelayRecipient)
    returns (bytes memory) {
        return BaseRelayRecipient._msgData();
    }

    function setPrivateBeta(
        bool enabled,
        address _privateBeta
    ) external onlyOwner {
        privateBetaOnly = enabled;
        privateBeta = ICaskPrivateBeta(_privateBeta);
    }

    function setProviderProfile(
        address _paymentAddress,
        string calldata _cid,
        uint256 _nonce
    ) external override {
        if (privateBetaOnly) {
            require(privateBeta.betaProviders(_msgSender()) > 0, "!PRIVATE_BETA_ONLY");
        }
        Provider storage profile = providerProfiles[_msgSender()];
        if (profile.nonce > 0) {
            require(_nonce > profile.nonce, "!NONCE");
        }
        profile.paymentAddress = _paymentAddress;
        profile.cid = _cid;
        profile.nonce = _nonce;

        emit ProviderSetProfile(_msgSender(), _paymentAddress, _nonce, _cid);
    }

    function getProviderProfile(
        address _provider
    ) external override view returns(Provider memory) {
        return providerProfiles[_provider];
    }

    function verifyPlan(
        bytes32 _planData,
        bytes32 _merkleRoot,
        bytes32[] calldata _merkleProof
    ) external override pure returns(bool) {
        return MerkleProof.verify(_merkleProof, _merkleRoot, keccak256(abi.encode(_planData)));
    }

    function getDiscountRedemptions(
        address _provider,
        uint32 _planId,
        bytes32 _discountId
    ) external view override returns(uint256) {
        return discountRedemptions[_provider][_planId][_discountId];
    }

    function verifyDiscount(
        address _consumer,
        address _provider,
        uint32 _planId,
        bytes32[] calldata _discountProof // [discountValidator, discountData, merkleRoot, merkleProof...]
    ) public view override returns(bytes32) {
        DiscountType discountType = _parseDiscountType(_discountProof[1]);

        if (discountType == DiscountType.Code) {
            return _verifyCodeDiscount(_consumer, _provider, _planId, _discountProof);
        } else if (discountType == DiscountType.ERC20) {
            return _verifyErc20Discount(_consumer, _provider, _planId, _discountProof);
        } else {
            return 0;
        }
    }

    function verifyAndConsumeDiscount(
        address _consumer,
        address _provider,
        uint32 _planId,
        bytes32[] calldata _discountProof // [discountValidator, discountData, merkleRoot, merkleProof...]
    ) external override returns(bytes32) {
        bytes32 discountId = verifyDiscount(_consumer, _provider, _planId, _discountProof);
        if (discountId > 0) {
            discountRedemptions[_provider][_planId][discountId] += 1;
        }
        return discountId;
    }

    function _verifyCodeDiscount(
        address _consumer,
        address _provider,
        uint32 _planId,
        bytes32[] calldata _discountProof // [discountValidator, discountData, merkleRoot, merkleProof...]
    ) internal view returns(bytes32) {
        if (_discountProof.length < 4 || _discountProof[0] == 0) {
            return 0;
        }

        bytes32 discountId = keccak256(abi.encode(_discountProof[0]));

        if (_verifyDiscountProof(discountId, _discountProof[1], _discountProof[2], _discountProof[3:]) &&
            _verifyDiscountData(discountId, _provider, _planId, _discountProof[1]))
        {
            return discountId;
        }
        return 0;
    }

    function _verifyErc20Discount(
        address _consumer,
        address _provider,
        uint32 _planId,
        bytes32[] calldata _discountProof // [discountValidator, discountData, merkleRoot, merkleProof...]
    ) internal view returns(bytes32) {
        if (_discountProof.length < 4 || _discountProof[0] == 0) {
            return 0;
        }

        bytes32 discountId = _discountProof[0];

        if (_verifyDiscountProof(discountId, _discountProof[1], _discountProof[2], _discountProof[3:]) &&
            erc20DiscountCurrentlyApplies(_consumer, discountId) &&
            _verifyDiscountData(discountId, _provider, _planId, _discountProof[1]))
        {
            return discountId;
        }
        return 0;
    }

    function _verifyDiscountProof(
        bytes32 _discountId,
        bytes32 _discountData,
        bytes32 _merkleRoot,
        bytes32[] calldata _merkleProof
    ) internal view returns(bool) {
        return MerkleProof.verify(_merkleProof, _merkleRoot, keccak256(abi.encode(_discountId, _discountData)));
    }

    function _verifyDiscountData(
        bytes32 _discountId,
        address _provider,
        uint32 _planId,
        bytes32 _discountData
    ) internal view returns(bool) {
        Discount memory discountInfo = _parseDiscountData(_discountData);

        return
            (discountInfo.planId == 0 || discountInfo.planId == _planId) &&
            (discountInfo.maxRedemptions == 0 ||
                discountRedemptions[_provider][discountInfo.planId][_discountId] < discountInfo.maxRedemptions) &&
            (discountInfo.validAfter == 0 || discountInfo.validAfter >= uint32(block.timestamp)) &&
            (discountInfo.expiresAt == 0 || discountInfo.expiresAt < uint32(block.timestamp));
    }

    function erc20DiscountCurrentlyApplies(
        address _consumer,
        bytes32 _discountValidator
    ) public view override returns(bool) {
        address token = address(bytes20(_discountValidator));
        uint8 decimals = uint8(bytes1(_discountValidator << 160));

        uint256 consumerBalance = IERC20(token).balanceOf(_consumer);
        if (decimals > 1) {
            consumerBalance = consumerBalance / uint256(10 ** decimals);
        }
        uint64 minBalance = uint64(bytes8(_discountValidator << 192));

        return consumerBalance >= minBalance;
    }

    function getPlanStatus(
        address _provider,
        uint32 _planId
    ) external view returns (PlanStatus) {
        return planStatus[_provider][_planId];
    }

    function getPlanEOL(
        address _provider,
        uint32 _planId
    ) external view returns (uint32) {
        return planEol[_provider][_planId];
    }

    function disablePlan(
        uint32 _planId
    ) external override {
        require(planStatus[_msgSender()][_planId] == PlanStatus.Enabled, "!NOT_ENABLED");

        planStatus[_msgSender()][_planId] = PlanStatus.Disabled;

        emit PlanDisabled(_msgSender(), _planId);
    }

    function enablePlan(
        uint32 _planId
    ) external override {
        require(planStatus[_msgSender()][_planId] == PlanStatus.Disabled, "!NOT_DISABLED");

        planStatus[_msgSender()][_planId] = PlanStatus.Enabled;

        emit PlanEnabled(_msgSender(), _planId);
    }

    function retirePlan(
        uint32 _planId,
        uint32 _retireAt
    ) external override {
        planStatus[_msgSender()][_planId] = PlanStatus.EndOfLife;
        planEol[_msgSender()][_planId] = _retireAt;

        emit PlanRetired(_msgSender(), _planId, _retireAt);
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
        subscriptionManager = _subscriptionManager;
    }

    function setTrustedForwarder(
        address _forwarder
    ) external onlyOwner {
        _setTrustedForwarder(_forwarder);
    }

    function _parseDiscountType(
        bytes32 _discountData
    ) internal pure returns(DiscountType) {
        return DiscountType(uint8(bytes1(_discountData << 248)));
    }

    function _parseDiscountData(
        bytes32 _discountData
    ) internal pure returns(Discount memory) {
        bytes1 options = bytes1(_discountData << 240);
        return Discount({
            value: uint256(_discountData >> 160),
            validAfter: uint32(bytes4(_discountData << 96)),
            expiresAt: uint32(bytes4(_discountData << 128)),
            maxRedemptions: uint32(bytes4(_discountData << 160)),
            planId: uint32(bytes4(_discountData << 192)),
            applyPeriods: uint16(bytes2(_discountData << 224)),
            discountType: DiscountType(uint8(bytes1(_discountData << 248))),
            isFixed: options & 0x01 == 0x01
        });
    }

}