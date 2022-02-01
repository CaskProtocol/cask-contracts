// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract MockUSDC is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("Cask USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
