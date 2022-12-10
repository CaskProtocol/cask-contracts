// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

contract WastefulUpkeep is KeeperCompatibleInterface {

    mapping(uint256 => uint256) data;

    function checkUpkeep(bytes calldata checkData)
    external returns (bool upkeepNeeded, bytes memory performData)
    {

        upkeepNeeded = true;
        performData = checkData;
    }

    function performUpkeep(bytes calldata performData)
    external
    {

        uint256 loops = abi.decode(performData, (uint256));

        for (uint i = 0; i < loops; i++) {
            data[block.timestamp * i] = block.timestamp;
        }
    }

}