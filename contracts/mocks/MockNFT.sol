// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/presets/ERC721PresetMinterPauserAutoId.sol";

contract MockNFT is ERC721PresetMinterPauserAutoId {
    constructor() ERC721PresetMinterPauserAutoId("Cask Mock NFT", "CMN", "http://nft.cask.fi/") {}
}
