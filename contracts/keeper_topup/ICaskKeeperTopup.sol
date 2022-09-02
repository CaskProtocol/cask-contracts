// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICaskKeeperTopup {

    enum KeeperTopupStatus {
        None,
        Active,
        Paused,
        Canceled
    }

    enum ManagerCommand {
        None,
        Cancel,
        Skip,
        Pause
    }

    enum SkipReason {
        None,
        PaymentFailed,
        SwapFailed,
        KeeperFundingFailure
    }

    struct KeeperTopup {
        address user;
        uint256 groupId;
        uint256 keeperId;
        uint256 lowBalance;
        uint256 topupAmount;
        uint256 currentAmount;
        uint256 numTopups;
        uint256 numSkips;
        uint32 createdAt;
        KeeperTopupStatus status;
    }

    struct KeeperTopupGroup {
        uint256 count;
        bytes32[] keeperTopups;
        uint32 processAt;
    }

    function createKeeperTopup(
        uint256 _keeperId,
        uint256 _lowBalance,
        uint256 _topupAmount
    ) external returns(bytes32);

    function getKeeperTopup(bytes32 _keeperTopupId) external view returns (KeeperTopup memory);

    function getKeeperTopupGroup(uint256 _keeperTopupGroupId) external view returns (KeeperTopupGroup memory);

    function getUserKeeperTopup(address _user, uint256 _idx) external view returns (bytes32);

    function getUserKeeperTopupCount(address _user) external view returns (uint256);

    function cancelKeeperTopup(bytes32 _keeperTopupId) external;

    function pauseKeeperTopup(bytes32 _keeperTopupId) external;

    function resumeKeeperTopup(bytes32 _keeperTopupId) external;

    function managerCommand(bytes32 _keeperTopupId, ManagerCommand _command) external;

    function managerProcessed(bytes32 _keeperTopupId) external;

    function managerSkipped(bytes32 _keeperTopupId, SkipReason _skipReason) external;


    event KeeperTopupCreated(bytes32 indexed keeperTopupId, address indexed user, uint256 indexed keeperId);

    event KeeperTopupPaused(bytes32 indexed keeperTopupId, uint256 indexed keeperId);

    event KeeperTopupResumed(bytes32 indexed keeperTopupId, uint256 indexed keeperId);

    event KeeperTopupSkipped(bytes32 indexed keeperTopupId, uint256 indexed keeperId, SkipReason skipReason);

    event KeeperTopupProcessed(bytes32 indexed keeperTopupId, uint256 indexed keeperId);

    event KeeperTopupCanceled(bytes32 indexed keeperTopupId, uint256 indexed keeperId);

}