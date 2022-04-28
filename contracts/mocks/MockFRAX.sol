// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract MockFRAX is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("Cask FRAX", "FRAX") {}
}