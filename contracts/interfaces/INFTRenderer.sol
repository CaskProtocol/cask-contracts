// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface INFTRenderer {

    function tokenURI(address _caskDCA, uint256 _tokenId) external view returns (string memory);

}
