// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../interfaces/IPegSwap.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract MockPegSwap is IPegSwap {
    using SafeERC20 for IERC20Metadata;

    function swap(
        uint256 amount,
        address source,
        address target
    ) external {
        IERC20Metadata(source).transferFrom(msg.sender, address(this), amount);
        IERC20Metadata(target).transfer(msg.sender, amount);
    }

}