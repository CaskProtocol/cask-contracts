// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../keeper_topup/KeeperRegistryBaseInterface.sol";

contract MockKeeperRegistry is KeeperRegistryBaseInterface {

    mapping(uint256 => uint96) public upkeepBalance;
    uint256 public upkeepCount;

    function registerUpkeep(
        address target,
        uint32 gasLimit,
        address admin,
        bytes calldata checkData
    ) external returns (
        uint256 id
    ){return 0;}

    function performUpkeep(
        uint256 id,
        bytes calldata performData
    ) external returns (
        bool success
    ) {return true;}

    function cancelUpkeep(
        uint256 id
    ) external {
        if (upkeepBalance[id] > 0 && upkeepCount > 0) {
            upkeepCount -= 1;
        }
        upkeepBalance[id] = 0;
    }

    function addFunds(
        uint256 id,
        uint96 amount
    ) external {
        if (upkeepBalance[id] == 0) {
            upkeepCount += 1;
        }
        upkeepBalance[id] += amount;
    }

    function spendFunds(
        uint256 id,
        uint96 amount
    ) external {
        require(amount <= upkeepBalance[id], "!balance");
        upkeepBalance[id] -= amount;
        if (upkeepBalance[id] == 0 && upkeepCount > 0) {
            upkeepCount -= 1;
        }
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
    ) {return (address(0), 0, bytes(""), upkeepBalance[id], address(0), address(0), type(uint64).max);}

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
}