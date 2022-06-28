// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICaskDCAManager {

    function registerDCA(bytes32 _dcaId) external;

    /** @dev Emitted when manager parameters are changed. */
    event SetParameters();

    /** @dev Emitted when a swap router address is blacklisted. */
    event BlacklistRouter(address indexed router);

    /** @dev Emitted when a swap router address is unblacklisted. */
    event UnblacklistRouter(address indexed router);
}