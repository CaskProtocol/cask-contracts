// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../keeper_topup/IPegSwap.sol";

contract MockPegSwap is IPegSwap {

    function swap(uint256 amount, address source, address target) external {
    }

}