// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICaskKeeperTopupManager {

    function registerKeeperTopupGroup(uint256 _keeperTopupId) external;

    /** @dev Emitted the feeDistributor is changed. */
    event SetFeeDistributor(address feeDistributor);
}