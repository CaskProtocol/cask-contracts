// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

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

    function verifyDiscount(
        address _provider,
        uint32 _planId,
        bytes32 _discountId,
        bytes32 _discountData,
        bytes32 _merkleRoot,
        bytes32[] calldata _merkleProof
    ) public view override returns(bool) {
        if (MerkleProof.verify(_merkleProof, _merkleRoot, keccak256(abi.encode(_discountId, _discountData)))) {
            Discount memory discountInfo = _parseDiscountData(_discountData);
            require(discountInfo.planId == 0 || discountInfo.planId == _planId, "!INVALID(planId)");

            if ( (discountInfo.maxRedemptions == 0 ||
            discountRedemptions[_provider][discountInfo.planId][_discountId] < discountInfo.maxRedemptions) &&
            (discountInfo.validAfter == 0 || discountInfo.validAfter >= uint32(block.timestamp)) &&
                (discountInfo.expiresAt == 0 || discountInfo.expiresAt < uint32(block.timestamp)) )
            {
                return true;
            }
        }
        return false;
    }

    function verifyAndConsumeDiscount(
        address _provider,
        uint32 _planId,
        bytes32 _discountId,
        bytes32 _discountData,
        bytes32 _merkleRoot,
        bytes32[] calldata _merkleProof
    ) external override returns(bool) {
        if (verifyDiscount(_provider, _planId, _discountId, _discountData, _merkleRoot, _merkleProof)) {
            discountRedemptions[_provider][_planId][_discountId] += 1;
            return true;
        }
        return false;
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

    function killPlan(
        uint32 _planId,
        uint32 _eolAt
    ) external override {
        planStatus[_msgSender()][_planId] = PlanStatus.EndOfLife;
        planEol[_msgSender()][_planId] = _eolAt;

        emit PlanEOL(_msgSender(), _planId, _eolAt);
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


    function _parseDiscountData(
        bytes32 _discountData
    ) internal pure returns(Discount memory) {
        bytes2 options = bytes2(_discountData << 240);
        return Discount({
            value: uint256(_discountData >> 160),
            validAfter: uint32(bytes4(_discountData << 96)),
            expiresAt: uint32(bytes4(_discountData << 128)),
            maxRedemptions: uint32(bytes4(_discountData << 160)),
            planId: uint32(bytes4(_discountData << 192)),
            applyPeriods: uint16(bytes2(_discountData << 224)),
            isFixed: options & 0x0001 == 0x0001
        });
    }

}