// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICaskDCA {

    enum DCAStatus {
        None,
        Active,
        Paused,
        Canceled,
        Complete
    }

    enum ManagerCommand {
        None,
        Cancel,
        Skip,
        Pause,
        Complete
    }

    struct DCA {
        address user;
        address router;
        address priceFeed;
        uint256 amount;
        uint256 numBuys;
        uint256 numSkips;
        uint256 totalAmount;
        uint256 slippageBps;
        uint256 maxPrice;
        uint256 minPrice;
        uint32 period;
        uint32 createdAt;
        uint32 processAt;
        uint32 completeAt;
        DCAStatus status;
        address[] path;
    }

    function createDCA(
        address[] calldata _assetSpec, // router, priceFeed, path...
        bytes32[] calldata _merkleProof,
        uint256 _amount,
        uint32 _period,
        uint256 _slippageBps,
        uint256[] calldata _priceLimits,
        uint32 _completeAt
    ) external returns(bytes32);

    function getDCA(bytes32 _dcaId) external view returns (DCA memory);

    function getUserDCAList(address _user, uint256 _limit, uint256 _offset) external view returns (bytes32[] memory);

    function getUserDCACount(address _user) external view returns (uint256);

    function cancelDCA(bytes32 _dcaId) external;

    function pauseDCA(bytes32 _dcaId) external;

    function resumeDCA(bytes32 _dcaId) external;

    function managerCommand(bytes32 _dcaId, ManagerCommand _command) external;

    function managerProcessed(bytes32 _dcaId, uint256 _amount) external;


    event DCACreated(bytes32 indexed dcaId, address indexed user, address inputAddress,
        address outputAsset, uint256 amount, uint32 period);

    event DCAPaused(bytes32 indexed dcaId, address indexed user);

    event DCAResumed(bytes32 indexed dcaId, address indexed user);

    event DCASkipped(bytes32 indexed dcaId, address indexed user);

    event DCAProcessed(bytes32 indexed dcaId, address indexed user);

    event DCACanceled(bytes32 indexed dcaId, address indexed user);

    event DCACompleted(bytes32 indexed dcaId, address indexed user);
}