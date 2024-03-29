// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract MockERC20 is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("Cask ERC20 Mock", "CEM") {}

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
