// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import "../interfaces/ICaskVault.sol";

contract MockVault is ICaskVault, ERC20Upgradeable {

    address baseAsset;

    constructor(address _baseAsset) {
        __ERC20_init("Mock Vault","vMockCASK");
        baseAsset = _baseAsset;
    }

    function getBaseAsset() external override view returns (address) {
        return baseAsset;
    }

    function getAllAssets() external override view returns (address[] memory) {
        return new address[](0);
    }

    function getAsset(address _asset) external override view returns (Asset memory) {
        return Asset({
            priceFeed: address(0),
            slippageBps: 0,
            depositLimit: 0,
            allowed: true,
            assetDecimals: 18,
            priceFeedDecimals: 18
        });
    }

    function protocolPayment(
        address _from,
        address _to,
        uint256 _value,
        uint256 _protocolFee,
        address _network,
        uint256 _networkFee
    ) external override {}

    function protocolPayment(
        address _from,
        address _to,
        uint256 _value,
        uint256 _protocolFee
    ) external override {}

    function protocolPayment(
        address _from,
        address _to,
        uint256 _value
    ) external override {}

    function payment(address _to, uint256 _amount) external override {
    }

    function deposit(address _asset, uint256 _amount) external override {
    }

    function depositTo(address _to, address _asset, uint256 _amount) external override {
    }

    function withdraw(address _asset, uint256 _amount) external override {
    }

    function withdrawTo(address _recipient, address _asset, uint256 _amount) external override {
    }

    function currentValueOf(address _address) external override view returns (uint256) {
        return 0;
    }

    function pricePerShare() external override view returns(uint256) {
        return 1;
    }

    function supportsAsset(address _asset) external override view returns (bool) {
        return true;
    }

    function totalValue() external override view returns(uint256) {
        return 0;
    }

    function totalAssetBalance(address _asset) external override view returns(uint256) {
        return 0;
    }

    function allocateToStrategy(address _strategy, address _asset, uint256 _amount) external override {

    }


}