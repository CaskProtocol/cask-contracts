// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../keeper_topup/KeeperRegistryBaseInterface.sol";
import "../keeper_topup/LinkTokenInterface.sol";
import "../erc677/IERC677Receiver.sol";

contract MockKeeperRegistry is KeeperRegistryBaseInterface, IERC677Receiver {

    mapping(uint256 => address) public upkeepAdmins;
    mapping(uint256 => uint96) public upkeepBalance;
    mapping(uint256 => uint256) public upkeepPerforms;
    uint256 public upkeepCount;

    LinkTokenInterface public linkToken;

    function initialize(
        address _linkToken
    ) external {
        linkToken = LinkTokenInterface(_linkToken);
    }

    function registerUpkeep(
        address target,
        uint32 gasLimit,
        address admin,
        bytes calldata checkData
    ) external returns(uint256) {
        upkeepCount += 1;

        upkeepAdmins[upkeepCount] = admin;
        return upkeepCount;
    }

    function performUpkeep(
        uint256 id,
        bytes calldata performData
    ) external returns (
        bool success
    ) {
        require(upkeepAdmins[id] != address(0), "!invalid");
        upkeepPerforms[id] += 1;
        return true;
    }

    function cancelUpkeep(
        uint256 id
    ) external {
        require(upkeepAdmins[id] != address(0), "!invalid");
        upkeepCount -= 1;
        upkeepBalance[id] = 0;
        upkeepAdmins[id] = address(0);
    }

    function addFunds(
        uint256 id,
        uint96 amount
    ) external {
        require(upkeepAdmins[id] != address(0), "!invalid");
        linkToken.transferFrom(msg.sender, address(this), amount);
        upkeepBalance[id] += amount;
    }

    function spendFunds(
        uint256 id,
        uint96 amount
    ) external {
        require(upkeepAdmins[id] != address(0), "!invalid");
        require(amount <= upkeepBalance[id], "!balance");
        upkeepBalance[id] -= amount;
    }

    function getUpkeep(uint256 id)
    external view returns (
        address target,
        uint32 executeGas,
        bytes memory checkData,
        uint96 balance,
        address lastKeeper,
        address admin,
        uint64 maxValidBlocknumber
    ) {return (address(0), 0, bytes(""), upkeepBalance[id], address(0), upkeepAdmins[id], type(uint64).max);}

    function getUpkeepCount()
    external view returns (uint256) {return upkeepCount;}

    function getCanceledUpkeepList()
    external view returns (uint256[] memory) {return new uint256[](0);}

    function getKeeperList()
    external view returns (address[] memory) { return new address[](0);}

    function getKeeperInfo(address query)
    external view returns (
        address payee,
        bool active,
        uint96 balance
    ) {return (address(0), true, 0);}

    function getConfig()
    external view returns (
        uint32 paymentPremiumPPB,
        uint24 checkFrequencyBlocks,
        uint32 checkGasLimit,
        uint24 stalenessSeconds,
        uint16 gasCeilingMultiplier,
        uint256 fallbackGasPrice,
        uint256 fallbackLinkPrice
    ) {return (0, 0, 0, 0, 0, 0, 0);}

    function onTokenTransfer(
        address sender,
        uint256 amount,
        bytes calldata data
    ) external {
        uint256 id = abi.decode(data, (uint256));

        require(upkeepAdmins[id] != address(0), "!invalid");
        upkeepBalance[id] += uint96(amount);
    }
}