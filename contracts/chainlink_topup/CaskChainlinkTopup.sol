// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@opengsn/contracts/src/BaseRelayRecipient.sol";

import "./ICaskChainlinkTopup.sol";
import "./ICaskChainlinkTopupManager.sol";

contract CaskChainlinkTopup is
ICaskChainlinkTopup,
Initializable,
OwnableUpgradeable,
PausableUpgradeable,
BaseRelayRecipient
{
    using SafeERC20 for IERC20Metadata;

    /** @dev contract to manage ChainlinkTopup executions. */
    ICaskChainlinkTopupManager public chainlinkTopupManager;

    /** @dev map of ChainlinkTopup ID to ChainlinkTopup info. */
    mapping(bytes32 => ChainlinkTopup) private chainlinkTopupMap; // chainlinkTopupId => ChainlinkTopup
    mapping(address => bytes32[]) private userChainlinkTopups; // user => chainlinkTopupId[]
    mapping(uint256 => ChainlinkTopupGroup) private chainlinkTopupGroupMap;

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

    modifier onlyUser(bytes32 _chainlinkTopupId) {
        require(_msgSender() == chainlinkTopupMap[_chainlinkTopupId].user, "!AUTH");
        _;
    }

    modifier onlyManager() {
        require(_msgSender() == address(chainlinkTopupManager), "!AUTH");
        _;
    }


    function createChainlinkTopup(
        uint256 _lowBalance,
        uint256 _topupAmount,
        uint256 _targetId,
        address _registry,
        TopupType _topupType
    ) external override returns(bytes32) {
        require(_topupAmount >= minTopupAmount, "!INVALID(topupAmount)");
        require(_topupType == TopupType.Automation ||
                _topupType == TopupType.VRF, "!INVALID(topupType)");
        require(chainlinkTopupManager.registryAllowed(_registry), "!INVALID(registry)");

        bytes32 chainlinkTopupId = keccak256(abi.encodePacked(_msgSender(), _targetId, _registry,
            block.number, block.timestamp));

        uint256 chainlinkTopupGroupId = _findGroupId();
        require(chainlinkTopupGroupId > 0, "!GROUP_ERROR");

        uint32 timestamp = uint32(block.timestamp);

        ChainlinkTopup storage chainlinkTopup = chainlinkTopupMap[chainlinkTopupId];
        chainlinkTopup.user = _msgSender();
        chainlinkTopup.groupId = chainlinkTopupGroupId;
        chainlinkTopup.lowBalance = _lowBalance;
        chainlinkTopup.topupAmount = _topupAmount;
        chainlinkTopup.createdAt = timestamp;
        chainlinkTopup.targetId = _targetId;
        chainlinkTopup.registry = _registry;
        chainlinkTopup.topupType = _topupType;
        chainlinkTopup.status = ChainlinkTopupStatus.Active;

        userChainlinkTopups[_msgSender()].push(chainlinkTopupId);

        ChainlinkTopupGroup storage chainlinkTopupGroup = chainlinkTopupGroupMap[chainlinkTopupGroupId];
        chainlinkTopupGroup.processAt = timestamp;
        chainlinkTopupGroup.chainlinkTopups.push(chainlinkTopupId);
        chainlinkTopupGroup.count += 1;

        if (chainlinkTopupGroup.count == 1) { // register only if new/reinitialized group
            chainlinkTopupManager.registerChainlinkTopupGroup(chainlinkTopupGroupId);
        }

        require(chainlinkTopup.status == ChainlinkTopupStatus.Active, "!UNPROCESSABLE");

        emit ChainlinkTopupCreated(chainlinkTopupId, chainlinkTopup.user, chainlinkTopup.targetId,
            chainlinkTopup.registry, chainlinkTopup.topupType);

        return chainlinkTopupId;
    }

    function _findGroupId() internal returns(uint256) {
        uint256 chainlinkTopupGroupId;
        if (backfillGroups.length > 0) {
            chainlinkTopupGroupId = backfillGroups[backfillGroups.length-1];
            backfillGroups.pop();
        } else {
            chainlinkTopupGroupId = currentGroup;
        }
        if (chainlinkTopupGroupId != currentGroup &&
            chainlinkTopupGroupMap[chainlinkTopupGroupId].count >= groupSize)
        {
            chainlinkTopupGroupId = currentGroup;
        }
        if (chainlinkTopupGroupMap[chainlinkTopupGroupId].count >= groupSize) {
            currentGroup += 1;
            chainlinkTopupGroupId = currentGroup;
        }
        return chainlinkTopupGroupId;
    }

    function pauseChainlinkTopup(
        bytes32 _chainlinkTopupId
    ) external override onlyUser(_chainlinkTopupId) {
        ChainlinkTopup storage chainlinkTopup = chainlinkTopupMap[_chainlinkTopupId];
        require(chainlinkTopup.status == ChainlinkTopupStatus.Active, "!NOT_ACTIVE");

        chainlinkTopup.status = ChainlinkTopupStatus.Paused;

        emit ChainlinkTopupPaused(_chainlinkTopupId, chainlinkTopup.targetId, chainlinkTopup.registry,
            chainlinkTopup.topupType);
    }

    function resumeChainlinkTopup(
        bytes32 _chainlinkTopupId
    ) external override onlyUser(_chainlinkTopupId) {
        ChainlinkTopup storage chainlinkTopup = chainlinkTopupMap[_chainlinkTopupId];
        require(chainlinkTopup.status == ChainlinkTopupStatus.Paused, "!NOT_PAUSED");

        chainlinkTopup.status = ChainlinkTopupStatus.Active;

        emit ChainlinkTopupResumed(_chainlinkTopupId, chainlinkTopup.targetId, chainlinkTopup.registry,
            chainlinkTopup.topupType);
    }

    function cancelChainlinkTopup(
        bytes32 _chainlinkTopupId
    ) external override onlyUser(_chainlinkTopupId) {
        ChainlinkTopup storage chainlinkTopup = chainlinkTopupMap[_chainlinkTopupId];
        require(chainlinkTopup.status == ChainlinkTopupStatus.Active ||
            chainlinkTopup.status == ChainlinkTopupStatus.Paused, "!INVALID(status)");

        chainlinkTopup.status = ChainlinkTopupStatus.Canceled;

        chainlinkTopupGroupMap[chainlinkTopup.groupId].count -= 1;
        backfillGroups.push(chainlinkTopup.groupId);

        emit ChainlinkTopupCanceled(_chainlinkTopupId, chainlinkTopup.targetId, chainlinkTopup.registry,
            chainlinkTopup.topupType);
    }

    function getChainlinkTopup(
        bytes32 _chainlinkTopupId
    ) external override view returns (ChainlinkTopup memory) {
        return chainlinkTopupMap[_chainlinkTopupId];
    }

    function getChainlinkTopupGroup(
        uint256 _chainlinkTopupGroupId
    ) external override view returns (ChainlinkTopupGroup memory) {
        return chainlinkTopupGroupMap[_chainlinkTopupGroupId];
    }

    function getUserChainlinkTopup(
        address _user,
        uint256 _idx
    ) external override view returns (bytes32) {
        return userChainlinkTopups[_user][_idx];
    }

    function getUserChainlinkTopupCount(
        address _user
    ) external override view returns (uint256) {
        return userChainlinkTopups[_user].length;
    }


    /************************** MANAGER FUNCTIONS **************************/

    function managerCommand(
        bytes32 _chainlinkTopupId,
        ManagerCommand _command
    ) external override onlyManager {

        ChainlinkTopup storage chainlinkTopup = chainlinkTopupMap[_chainlinkTopupId];

        if (_command == ManagerCommand.Pause) {

            chainlinkTopup.status = ChainlinkTopupStatus.Paused;

            emit ChainlinkTopupPaused(_chainlinkTopupId, chainlinkTopup.targetId, chainlinkTopup.registry,
                chainlinkTopup.topupType);

        } else if (_command == ManagerCommand.Cancel) {

            chainlinkTopup.status = ChainlinkTopupStatus.Canceled;

            chainlinkTopupGroupMap[chainlinkTopup.groupId].count -= 1;
            backfillGroups.push(chainlinkTopup.groupId);

            emit ChainlinkTopupCanceled(_chainlinkTopupId, chainlinkTopup.targetId, chainlinkTopup.registry,
                chainlinkTopup.topupType);

        }
    }

    function managerProcessed(
        bytes32 _chainlinkTopupId,
        uint256 _amount,
        uint256 _buyQty,
        uint256 _fee
    ) external override onlyManager {
        ChainlinkTopup storage chainlinkTopup = chainlinkTopupMap[_chainlinkTopupId];

        chainlinkTopup.currentAmount += _amount;
        chainlinkTopup.numTopups += 1;

        emit ChainlinkTopupProcessed(_chainlinkTopupId, chainlinkTopup.targetId, chainlinkTopup.registry,
            chainlinkTopup.topupType, _amount, _buyQty, _fee);
    }

    function managerProcessedGroup(
        uint256 _chainlinkTopupGroupId,
        uint32 _nextProcessAt
    ) external override onlyManager {
        ChainlinkTopupGroup storage chainlinkTopupGroup = chainlinkTopupGroupMap[_chainlinkTopupGroupId];

        chainlinkTopupGroup.processAt = _nextProcessAt;

        emit ChainlinkTopupGroupProcessed(_chainlinkTopupGroupId);
    }

    function managerSkipped(
        bytes32 _chainlinkTopupId,
        SkipReason _skipReason
    ) external override onlyManager {
        ChainlinkTopup storage chainlinkTopup = chainlinkTopupMap[_chainlinkTopupId];

        chainlinkTopup.numSkips += 1;

        emit ChainlinkTopupSkipped(_chainlinkTopupId, chainlinkTopup.targetId, chainlinkTopup.registry,
            chainlinkTopup.topupType, _skipReason);
    }

    /************************** ADMIN FUNCTIONS **************************/

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setManager(
        address _chainlinkTopupManager
    ) external onlyOwner {
        chainlinkTopupManager = ICaskChainlinkTopupManager(_chainlinkTopupManager);
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