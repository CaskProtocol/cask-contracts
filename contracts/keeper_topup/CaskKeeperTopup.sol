// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@opengsn/contracts/src/BaseRelayRecipient.sol";

import "./ICaskKeeperTopup.sol";
import "./ICaskKeeperTopupManager.sol";

contract CaskKeeperTopup is
ICaskKeeperTopup,
Initializable,
OwnableUpgradeable,
PausableUpgradeable,
BaseRelayRecipient
{
    using SafeERC20 for IERC20Metadata;

    /** @dev contract to manage KeeperTopup executions. */
    ICaskKeeperTopupManager public keeperTopupManager;

    /** @dev map of KeeperTopup ID to KeeperTopup info. */
    mapping(bytes32 => KeeperTopup) private keeperTopupMap; // keeperTopupId => KeeperTopup
    mapping(address => bytes32[]) private userKeeperTopups; // user => keeperTopupId[]
    mapping(uint256 => KeeperTopupGroup) private keeperTopupGroupMap;

    uint256 public currentGroup;

    uint256[] public backfillGroups;

    /** @dev minimum amount to allow for a topup. */
    uint256 public minTopupAmount;

    uint256 public groupSize;

    function initialize(
        uint256 _groupSize
    ) public initializer {
        __Ownable_init();
        __Pausable_init();

        currentGroup = 1;
        groupSize = _groupSize;
    }
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function versionRecipient() public pure override returns(string memory) { return "2.2.0"; }

    function _msgSender() internal view override(ContextUpgradeable, BaseRelayRecipient)
    returns (address sender) {
        sender = BaseRelayRecipient._msgSender();
    }

    function _msgData() internal view override(ContextUpgradeable, BaseRelayRecipient)
    returns (bytes calldata) {
        return BaseRelayRecipient._msgData();
    }

    modifier onlyUser(bytes32 _keeperTopupId) {
        require(_msgSender() == keeperTopupMap[_keeperTopupId].user, "!AUTH");
        _;
    }

    modifier onlyManager() {
        require(_msgSender() == address(keeperTopupManager), "!AUTH");
        _;
    }


    function createKeeperTopup(
        uint256 _lowBalance,
        uint256 _topupAmount,
        uint256 _targetId,
        address _registry,
        TopupType _topupType
    ) external override returns(bytes32) {
        require(_topupAmount >= minTopupAmount, "!INVALID(topupAmount)");

        bytes32 keeperTopupId = keccak256(abi.encodePacked(_msgSender(), _targetId, _registry, block.number, block.timestamp));

        uint256 keeperTopupGroupId = _findGroupId();
        require(keeperTopupGroupId > 0, "!GROUP_ERROR");

        uint32 timestamp = uint32(block.timestamp);

        KeeperTopup storage keeperTopup = keeperTopupMap[keeperTopupId];
        keeperTopup.user = _msgSender();
        keeperTopup.groupId = keeperTopupGroupId;
        keeperTopup.lowBalance = _lowBalance;
        keeperTopup.topupAmount = _topupAmount;
        keeperTopup.createdAt = timestamp;
        keeperTopup.targetId = _targetId;
        keeperTopup.registry = _registry;
        keeperTopup.topupType = _topupType;
        keeperTopup.status = KeeperTopupStatus.Active;

        userKeeperTopups[_msgSender()].push(keeperTopupId);

        KeeperTopupGroup storage keeperTopupGroup = keeperTopupGroupMap[keeperTopupGroupId];
        keeperTopupGroup.processAt = timestamp;
        keeperTopupGroup.keeperTopups.push(keeperTopupId);
        keeperTopupGroup.count += 1;

        if (keeperTopupGroup.count == 1) { // register only if new/reinitialized group
            keeperTopupManager.registerKeeperTopupGroup(keeperTopupGroupId);
        }

        require(keeperTopup.status == KeeperTopupStatus.Active, "!UNPROCESSABLE");

        emit KeeperTopupCreated(keeperTopupId, keeperTopup.user, keeperTopup.targetId,
            keeperTopup.registry, keeperTopup.topupType);

        return keeperTopupId;
    }

    function _findGroupId() internal returns(uint256) {
        uint256 keeperTopupGroupId;
        if (backfillGroups.length > 0) {
            keeperTopupGroupId = backfillGroups[backfillGroups.length-1];
            backfillGroups.pop();
        } else {
            keeperTopupGroupId = currentGroup;
        }
        if (keeperTopupGroupId != currentGroup && keeperTopupGroupMap[keeperTopupGroupId].count >= groupSize) {
            keeperTopupGroupId = currentGroup;
        }
        if (keeperTopupGroupMap[keeperTopupGroupId].count >= groupSize) {
            currentGroup += 1;
            keeperTopupGroupId = currentGroup;
        }
        return keeperTopupGroupId;
    }

    function pauseKeeperTopup(
        bytes32 _keeperTopupId
    ) external override onlyUser(_keeperTopupId) {
        KeeperTopup storage keeperTopup = keeperTopupMap[_keeperTopupId];
        require(keeperTopup.status == KeeperTopupStatus.Active, "!NOT_ACTIVE");

        keeperTopup.status = KeeperTopupStatus.Paused;

        emit KeeperTopupPaused(_keeperTopupId, keeperTopup.targetId, keeperTopup.registry, keeperTopup.topupType);
    }

    function resumeKeeperTopup(
        bytes32 _keeperTopupId
    ) external override onlyUser(_keeperTopupId) {
        KeeperTopup storage keeperTopup = keeperTopupMap[_keeperTopupId];
        require(keeperTopup.status == KeeperTopupStatus.Paused, "!NOT_PAUSED");

        keeperTopup.status = KeeperTopupStatus.Active;

        emit KeeperTopupResumed(_keeperTopupId, keeperTopup.targetId, keeperTopup.registry, keeperTopup.topupType);
    }

    function cancelKeeperTopup(
        bytes32 _keeperTopupId
    ) external override onlyUser(_keeperTopupId) {
        KeeperTopup storage keeperTopup = keeperTopupMap[_keeperTopupId];
        require(keeperTopup.status == KeeperTopupStatus.Active ||
            keeperTopup.status == KeeperTopupStatus.Paused, "!INVALID(status)");

        keeperTopup.status = KeeperTopupStatus.Canceled;

        keeperTopupGroupMap[keeperTopup.groupId].count -= 1;
        backfillGroups.push(keeperTopup.groupId);

        emit KeeperTopupCanceled(_keeperTopupId, keeperTopup.targetId, keeperTopup.registry, keeperTopup.topupType);
    }

    function getKeeperTopup(
        bytes32 _keeperTopupId
    ) external override view returns (KeeperTopup memory) {
        return keeperTopupMap[_keeperTopupId];
    }

    function getKeeperTopupGroup(
        uint256 _keeperTopupGroupId
    ) external override view returns (KeeperTopupGroup memory) {
        return keeperTopupGroupMap[_keeperTopupGroupId];
    }

    function getUserKeeperTopup(
        address _user,
        uint256 _idx
    ) external override view returns (bytes32) {
        return userKeeperTopups[_user][_idx];
    }

    function getUserKeeperTopupCount(
        address _user
    ) external override view returns (uint256) {
        return userKeeperTopups[_user].length;
    }


    /************************** MANAGER FUNCTIONS **************************/

    function managerCommand(
        bytes32 _keeperTopupId,
        ManagerCommand _command
    ) external override onlyManager {

        KeeperTopup storage keeperTopup = keeperTopupMap[_keeperTopupId];

        if (_command == ManagerCommand.Pause) {

            keeperTopup.status = KeeperTopupStatus.Paused;

            emit KeeperTopupPaused(_keeperTopupId, keeperTopup.targetId, keeperTopup.registry, keeperTopup.topupType);

        } else if (_command == ManagerCommand.Cancel) {

            keeperTopup.status = KeeperTopupStatus.Canceled;

            keeperTopupGroupMap[keeperTopup.groupId].count -= 1;
            backfillGroups.push(keeperTopup.groupId);

            emit KeeperTopupCanceled(_keeperTopupId, keeperTopup.targetId, keeperTopup.registry, keeperTopup.topupType);

        }
    }

    function managerProcessed(
        bytes32 _keeperTopupId
    ) external override onlyManager {
        KeeperTopup storage keeperTopup = keeperTopupMap[_keeperTopupId];

        keeperTopup.currentAmount += keeperTopup.topupAmount;
        keeperTopup.numTopups += 1;

        emit KeeperTopupProcessed(_keeperTopupId, keeperTopup.targetId, keeperTopup.registry, keeperTopup.topupType);
    }

    function managerProcessedGroup(
        uint256 _keeperTopupGroupId,
        uint32 _nextProcessAt
    ) external override onlyManager {
        KeeperTopupGroup storage keeperTopupGroup = keeperTopupGroupMap[_keeperTopupGroupId];

        keeperTopupGroup.processAt = _nextProcessAt;

        emit KeeperTopupGroupProcessed(_keeperTopupGroupId);
    }

    function managerSkipped(
        bytes32 _keeperTopupId,
        SkipReason _skipReason
    ) external override onlyManager {
        KeeperTopup storage keeperTopup = keeperTopupMap[_keeperTopupId];

        keeperTopup.numSkips += 1;

        emit KeeperTopupSkipped(_keeperTopupId, keeperTopup.targetId, keeperTopup.registry, keeperTopup.topupType,
            _skipReason);
    }

    /************************** ADMIN FUNCTIONS **************************/

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setManager(
        address _keeperTopupManager
    ) external onlyOwner {
        keeperTopupManager = ICaskKeeperTopupManager(_keeperTopupManager);
    }

    function setTrustedForwarder(
        address _forwarder
    ) external onlyOwner {
        _setTrustedForwarder(_forwarder);
    }

    function setMinTopupAmount(
        uint256 _minTopupAmount
    ) external onlyOwner {
        minTopupAmount = _minTopupAmount;
    }

}