// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IERC677Receiver {
    function onTokenTransfer(
        address sender,
        uint value,
        bytes memory data
    )
    external;
}