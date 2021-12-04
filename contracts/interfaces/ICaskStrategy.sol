// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

 /**
  * @title  Interface for yield earning strategies.
  */

interface ICaskStrategy {
    /**
     * @dev Deposit an amount of asset into the strategy
     * @param _asset Asset address
     * @param _amount Amount of asset to deposit
     */
    function deposit(address _asset, uint256 _amount) external;

    /**
     * @dev Deposit all assets in the contract to the strategy
     */
    function depositAll() external;

    /**
     * @dev Withdraw an amount of asset from the strategy
     * @param _recipient Recipient of asset being withdrawn
     * @param _asset Asset address
     * @param _amount Amount of asset to withdraw
     */
    function withdraw(address _recipient, address _asset, uint256 _amount) external;

    /**
     * @dev Withdraw all assets from the strategy and send to the vault
     */
    function withdrawAll() external;

    /**
     * @dev Get the current balance of an asset in the strategy
     * @param _asset Asset address
     * @return balance Total balance of asset currently in the strategy
     */
    function assetBalance(address _asset) external view returns (uint256 balance);

    /**
     * @dev Check if the strategy supports an asset
     * @param _asset Asset address
     * @return bool `true` if asset supported, `false` otherwise
     */
    function supportsAsset(address _asset) external view returns (bool);
}