// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract MockChainlinkOracleFeed is AggregatorV3Interface {
    int256 price;
    uint8 numDecimals;
    uint256 age;

    constructor(int256 _price, uint8 _decimals) {
        price = _price;
        numDecimals = _decimals;
        age = 30;
    }

    function decimals() external view override returns (uint8) {
        return numDecimals;
    }

    function description() external pure override returns (string memory) {
        return "MockOracleFeed";
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function setPrice(int256 _price) public {
        price = _price;
    }

    function setDecimals(uint8 _decimals) public {
        numDecimals = _decimals;
    }

    function setAge(uint256 _age) public {
        age = _age;
    }

    // getRoundData and latestRoundData should both raise "No data present"
    // if they do not have data to report, instead of returning unset values
    // which could be misinterpreted as actual reported values.
    function getRoundData(uint80 _roundId)
    external
    view
    override
    returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    )
    {
        roundId = _roundId;
        answer = price;
        startedAt = block.timestamp - age;
        updatedAt = block.timestamp - age;
        answeredInRound = 0;
    }

    function latestRoundData()
    external
    view
    override
    returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    )
    {
        roundId = 0;
        answer = price;
        startedAt = block.timestamp - age;
        updatedAt = block.timestamp - age;
        answeredInRound = 0;
    }
}
