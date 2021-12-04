// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title  Interface for vault admin
  */

interface ICaskVaultAdmin {

    /**
      * @dev total value of `_asset` managed by admin - denominated in native asset
     */
    function assetBalanceManaged(address _asset) external view returns(uint256);

}
