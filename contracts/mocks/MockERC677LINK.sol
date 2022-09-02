// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "../erc677/ERC677.sol";

contract MockERC677LINK is ERC20PresetMinterPauser, ERC677 {

    constructor() ERC20PresetMinterPauser("Cask ERC677LINK", "ERC677LINK") {}

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal override(ERC20PresetMinterPauser, ERC20) {
        return ERC20PresetMinterPauser._beforeTokenTransfer(from, to, amount);
    }
}
