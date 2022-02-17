// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract CaskPrivateBeta is
OwnableUpgradeable
{
    mapping(address => uint256) public betaProviders; // address -> timestamp

    function initialize() public initializer {
        __Ownable_init();
    }
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function addBetaProvider(
        address _provider
    ) external onlyOwner {
        betaProviders[_provider] = block.timestamp;
    }

}