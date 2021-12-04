// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title  Interface for vault
  */

interface ICaskVault {

    // whitelisted stablecoin assets supported by the vault
    struct Asset {
        address priceFeed;
        uint256 slippageBps;
        uint256 depositLimit;
        uint8 assetDecimals;
        uint8 priceFeedDecimals;
        bool allowed;
    }


    /**
      * @dev Get base asset of vault.
     */
    function getBaseAsset() external view returns (address);

    /**
      * @dev Get all the assets supported by the vault.
     */
    function getAllAssets() external view returns (address[] memory);

    /**
     * @dev Get asset details
     * @param _asset Asset address
     * @return Asset Asset details
     */
    function getAsset(address _asset) external view returns(Asset memory);

    /**
     * @dev Check if the vault supports an asset
     * @param _asset Asset address
     * @return bool `true` if asset supported, `false` otherwise
     */
    function supportsAsset(address _asset) external view returns (bool);

    /**
     * @dev Pay `_baseAssetAmount` of `baseAsset` from `_from` to `_to`
     * @param _from From address
     * @param _to To address
     * @param _baseAssetAmount Amount of asset to transfer
     * @param _baseAssetFee Fee to deduct from `_baseAssetAmount`
     */
    function payment(address _from, address _to, uint256 _baseAssetAmount, uint256 _baseAssetFee) external;

    /**
     * @dev Deposit `_assetAmount` of `_asset` into the vault and credit the equivalent value of `baseAsset`
     * @param _asset Address of incoming asset
     * @param _assetAmount Amount of asset to deposit
     */
    function deposit(address _asset, uint256 _assetAmount) external;

    /**
     * @dev Withdraw an amount of shares from the vault in the form of `_asset`
     * @param _recipient Recipient who will receive the withdrawn assets
     * @param _asset Address of outgoing asset
     * @param _shares Amount of shares to withdraw
     */
    function withdraw(address _recipient, address _asset, uint256 _shares) external;

    /**
     * @dev Get total shares of vault
     */
    function totalSupply() external view returns(uint256);

    /**
     * @dev Get current balance of shares for an address
     * @param _address Address to check
     */
    function balanceOf(address _address) external view returns(uint256);

    /**
     * @dev Get current vault value of `_address` denominated in `baseAsset`
     * @param _address Address to check
     */
    function currentValueOf(address _address) external view returns(uint256);

    /**
     * @dev Get total value in vault and managed by admin - denominated in `baseAsset`
     */
    function totalValue() external view returns(uint256);

    /**
     * @dev Get total amount of an asset held in vault and managed by admin
     * @param _asset Address of asset
     */
    function totalAssetBalance(address _asset) external view returns(uint256);

    /**
     * @dev Send an amount of asset to a strategy
     * @param _asset Address of strategy
     * @param _asset Address of asset
     * @param _assetAmount Amount of asset to send
     */
    function allocateToStrategy(address _strategy, address _asset, uint256 _assetAmount) external;


    /************************** EVENTS **************************/

    /** @dev Emitted when an amount of `baseAsset` is paid from `from` to `to` within the vault */
    event Payment(address indexed from, address indexed to, uint256 baseAssetAmount, uint256 baseAssetFee,
        uint256 shares);

    /** @dev Emitted when `asset` is added as a new supported asset */
    event AllowedAsset(address indexed asset);

    /** @dev Emitted when `participant` deposits `asset` */
    event AssetDeposited(address indexed participant, address indexed asset, uint256 assetAmount,
        uint256 baseAssetAmount, uint256 shares);

    /** @dev Emitted when `participant` withdraws `asset` */
    event AssetWithdrawn(address indexed participant, address indexed asset, uint256 assetAmount,
        uint256 baseAssetAmount, uint256 shares);

    /** @dev Emitted when `asset` is allocated to strategy `strategy` */
    event AllocatedToStrategy(address indexed strategy, address indexed asset, uint256 assetAmount);

}