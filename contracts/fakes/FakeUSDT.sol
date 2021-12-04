// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract FakeUSDT is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("Cask Fake USDT", "USDT") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
