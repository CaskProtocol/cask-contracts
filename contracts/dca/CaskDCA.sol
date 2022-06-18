// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@opengsn/contracts/src/BaseRelayRecipient.sol";

import "../interfaces/ICaskDCA.sol";
import "../interfaces/ICaskDCAManager.sol";

contract CaskDCA is
ICaskDCA,
Initializable,
OwnableUpgradeable,
PausableUpgradeable,
ReentrancyGuardUpgradeable,
BaseRelayRecipient
{
    using SafeERC20 for IERC20Metadata;

    /** @dev contract to manage DCA executions. */
    ICaskDCAManager public dcaManager;

    /** @dev merkle root of approved assets. */
    bytes32 public assetsMerkleRoot;

    /** @dev map of DCA ID to DCA info. */
    mapping(bytes32 => DCA) private dcaMap; // dcaId => DCA


    function initialize(
        bytes32 _assetsMerkleRoot
    ) public initializer {
        assetsMerkleRoot = _assetsMerkleRoot;
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

    modifier onlyUser(bytes32 _dcaId) {
        require(_msgSender() == dcaMap[_dcaId].user, "!AUTH");
        _;
    }

    modifier onlyManager() {
        require(_msgSender() == address(dcaManager), "!AUTH");
        _;
    }


    function createDCA(
        address[] calldata _assetSpec, // inputAsset, outputAsset, router, priceFeed
        bytes32[] calldata _merkleProof,
        uint256 _amount,
        uint32 _period,
        uint256 _slippageBps,
        uint256[] calldata _priceLimits,
        uint32 _finishAt,
        uint256 _finishAtNumBuys,
        uint256 _finishAtTotalAmount
    ) external override returns(bytes32) {
        require(_amount > 0, "!INVALID(amount)");
        require(_period > 86400, "!INVALID(period)");
        require(_assetSpec.length == 4, "!INVALID(assetSpec)");
        require(_verifyAssetSpec(_assetSpec, _merkleProof), "!INVALID(assetSpec)");

        bytes32 dcaId = keccak256(abi.encodePacked(_msgSender(), _assetSpec, _amount, _period,
            block.number, block.timestamp));

        uint32 timestamp = uint32(block.timestamp);

        DCA storage dca = dcaMap[dcaId];
        dca.user = _msgSender();
        dca.inputAsset = _assetSpec[0];
        dca.outputAsset = _assetSpec[1];
        dca.router = _assetSpec[2];
        dca.priceFeed = _assetSpec[3];
        dca.amount = _amount;
        dca.period = _period;
        dca.assetDecimals = IERC20Metadata(_assetSpec[1]).decimals();
        dca.priceFeedDecimals = AggregatorV3Interface(_assetSpec[3]).decimals();
        dca.minPrice = _priceLimits[0];
        dca.maxPrice = _priceLimits[1];
        dca.slippageBps = _slippageBps;
        dca.createdAt = timestamp;
        dca.processAt = timestamp;
        dca.finishAt = _finishAt;
        dca.finishAtNumBuys = _finishAtNumBuys;
        dca.finishAtTotalAmount = _finishAtTotalAmount;
        dca.status = DCAStatus.Active;

        dcaManager.registerDCA(dcaId);

        return dcaId;
    }

    function pauseDCA(
        bytes32 _dcaId
    ) external override onlyUser(_dcaId) {
        DCA storage dca = dcaMap[_dcaId];
        require(dca.status == DCAStatus.Active, "!NOT_ACTIVE");

        dca.status = DCAStatus.Paused;

        emit DCAPaused(_dcaId, dca.user);
    }

    function resumeDCA(
        bytes32 _dcaId
    ) external override onlyUser(_dcaId) {
        DCA storage dca = dcaMap[_dcaId];
        require(dca.status == DCAStatus.Paused, "!NOT_PAUSED");

        dca.status = DCAStatus.Active;

        if (dca.processAt < uint32(block.timestamp)) {
            dca.processAt = uint32(block.timestamp);
        }

        dcaManager.registerDCA(_dcaId);

        emit DCAResumed(_dcaId, dca.user);
    }

    function cancelDCA(
        bytes32 _dcaId
    ) external override onlyUser(_dcaId) {
        DCA storage dca = dcaMap[_dcaId];
        require(dca.status == DCAStatus.Active ||
                dca.status == DCAStatus.Paused, "!INVALID(status)");

        dca.status = DCAStatus.Canceled;

        emit DCAResumed(_dcaId, dca.user);
    }

    function managerCommand(
        bytes32 _dcaId,
        ManagerCommand _command
    ) external override onlyManager {

        DCA storage dca = dcaMap[_dcaId];

        if (_command == ManagerCommand.Skip) {

            dca.processAt = dca.processAt + dca.period;
            dca.numSkips += 1;

            emit DCASkipped(_dcaId, dca.user);

        } else if (_command == ManagerCommand.Pause) {

            dca.status = DCAStatus.Paused;

            emit DCAPaused(_dcaId, dca.user);

        } else if (_command == ManagerCommand.Cancel) {

            dca.status = DCAStatus.Canceled;

            emit DCACanceled(_dcaId, dca.user);

        } else if (_command == ManagerCommand.Finish) {

            dca.status = DCAStatus.Finished;

            emit DCAFinished(_dcaId, dca.user);
        }
    }

    function managerProcessed(
        bytes32 _dcaId,
        uint256 _amount
    ) external override onlyManager {
        DCA storage dca = dcaMap[_dcaId];

        dca.processAt = dca.processAt + dca.period;
        dca.totalAmount += _amount;
        dca.numBuys += 1;

        emit DCAProcessed(_dcaId, dca.user);
    }

    function _verifyAssetSpec(
        address[] calldata _assetSpec,
        bytes32[] calldata _merkleProof
    ) internal view returns(bool) {
        return MerkleProof.verify(_merkleProof, assetsMerkleRoot, keccak256(abi.encode(_assetSpec)));
    }

    function getDCA(
        bytes32 _dcaId
    ) external override view returns (DCA memory) {
        return dcaMap[_dcaId];
    }

    /************************** ADMIN FUNCTIONS **************************/

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setManager(
        address _dcaManager
    ) external onlyOwner {
        dcaManager = ICaskDCAManager(_dcaManager);
    }

    function setTrustedForwarder(
        address _forwarder
    ) external onlyOwner {
        _setTrustedForwarder(_forwarder);
    }

    function setAssetsMerkleRoot(
        bytes32 _assetsMerkleRoot
    ) external onlyOwner {
        assetsMerkleRoot = _assetsMerkleRoot;
    }

}