// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../interfaces/VRFCoordinatorV2Interface.sol";
import "../erc677/IERC677Receiver.sol";

contract MockVRFCoordinator is VRFCoordinatorV2Interface, IERC677Receiver {

    mapping(uint64 => address) public vrfOwners;
    mapping(uint64 => uint96) public vrfBalance;
    mapping(uint64 => uint256) public vrfPerforms;
    uint64 public vrfCount;

    function getRequestConfig()
    external
    view
    returns (
        uint16,
        uint32,
        bytes32[] memory
    ) { return (0, 0, new bytes32[](0)); }

    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external returns (uint256 requestId) { return 0; }

    function createSubscription() external returns (uint64 subId) {
        vrfCount += 1;

        vrfOwners[vrfCount] = msg.sender;
        return vrfCount;
    }

    function getSubscription(uint64 subId)
    external
    view
    returns (
        uint96 balance,
        uint64 reqCount,
        address owner,
        address[] memory consumers
    ) { return (vrfBalance[subId], 0, vrfOwners[subId], new address[](0)); }

    function requestSubscriptionOwnerTransfer(uint64 subId, address newOwner) external {}

    function acceptSubscriptionOwnerTransfer(uint64 subId) external {}

    function addConsumer(uint64 subId, address consumer) external {}

    function removeConsumer(uint64 subId, address consumer) external {}

    function cancelSubscription(uint64 subId, address to) external {
        require(vrfOwners[subId] != address(0), "!invalid");
        vrfCount -= 1;
        vrfBalance[subId] = 0;
        vrfOwners[subId] = address(0);
    }

    function onTokenTransfer(
        address sender,
        uint256 amount,
        bytes calldata data
    ) external {
        uint64 subId = abi.decode(data, (uint64));

        require(vrfOwners[subId] != address(0), "!invalid");
        vrfBalance[subId] += uint96(amount);
    }

    function spendFunds(
        uint64 subId,
        uint96 amount
    ) external {
        require(vrfOwners[subId] != address(0), "!invalid");
        require(amount <= vrfBalance[subId], "!balance");
        vrfBalance[subId] -= amount;
    }
}