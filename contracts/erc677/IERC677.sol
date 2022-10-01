// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IERC677 {
    function transferAndCall(
        address to,
        uint value,
        bytes memory data
    )
    external
    returns (bool success);

    event Transfer(
        address indexed from,
        address indexed to,
        uint value,
        bytes data
    );
}