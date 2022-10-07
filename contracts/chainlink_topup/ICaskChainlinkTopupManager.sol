// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICaskChainlinkTopupManager {

    function registerChainlinkTopupGroup(uint256 _chainlinkTopupId) external;

    /** @dev Emitted the feeDistributor is changed. */
    event SetFeeDistributor(address feeDistributor);
}