// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICaskSubscriptionManager {

    enum CheckType {
        None,
        Active,
        PastDue
    }

    function processSinglePayment(address _consumer, address _provider, uint256 _subscriptionId, uint256 _value) external;

    function renewSubscription(uint256 _subscriptionId) external;

}
