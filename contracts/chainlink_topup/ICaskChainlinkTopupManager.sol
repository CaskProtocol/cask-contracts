// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICaskChainlinkTopupManager {

    function registerChainlinkTopupGroup(uint256 _chainlinkTopupId) external;

    function registryAllowed(address _registry) external view returns(bool);

    /** @dev Emitted the feeDistributor is changed. */
    event SetFeeDistributor(address feeDistributor);

    /** @dev Emitted when a registry is allowed. */
    event RegistryAllowed(address registry);

    /** @dev Emitted when a registry is disallowed. */
    event RegistryDisallowed(address registry);
}