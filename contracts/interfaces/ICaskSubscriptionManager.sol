// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICaskSubscriptionManager {

    function processSinglePayment(address _consumer, address _provider, uint256 _subscriptionId, uint256 _amount) external;

    function renewSubscription(uint256 _subscriptionId) external;

    function rebateGas(uint256 _initialGasLeft, uint256 _gasRefundLimit) external;

}
