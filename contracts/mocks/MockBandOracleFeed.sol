// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../interfaces/IStdReference.sol";

contract MockBandOracleFeed is IStdReference {
    uint256 price;
    uint256 age;

    constructor(uint256 _price, uint8 _decimals) {
        price = _price;
        age = 30;
    }

    function setPrice(uint256 _price) public {
        price = _price;
    }

    function setAge(uint256 _age) public {
        age = _age;
    }

    function getReferenceData(string memory _base, string memory _quote)
    external
    view
    returns (ReferenceData memory) {
        return ReferenceData({
            rate: price,
            lastUpdatedBase: block.timestamp - age,
            lastUpdatedQuote: block.timestamp - age
        });
    }

    function getReferenceDataBulk(string[] memory _bases, string[] memory _quotes)
    external
    view
    returns (ReferenceData[] memory) {
        ReferenceData[] memory data = new ReferenceData[](1);
        data[0] = ReferenceData({
            rate: price,
            lastUpdatedBase: block.timestamp - age,
            lastUpdatedQuote: block.timestamp - age
        });
        return data;
    }

}
