// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";


abstract contract CaskBaseStrategy is
Initializable,
OwnableUpgradeable,
PausableUpgradeable
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Address for address;

    address public insuranceManager;


    function initialize(address _insuranceManager) public initializer {
        __Ownable_init();
        __Pausable_init();

        insuranceManager = _insuranceManager;
    }

    function pause() external {
        _pause();
    }

    function unpause() external {
        _unpause();
    }

    /**
     * @dev Deposit an amount of asset into the strategy
     * @param _asset Asset address
     * @param _amount Amount of asset to deposit
     */
    function deposit(address _asset, uint256 _amount) external virtual;

    /**
     * @dev Deposit all assets in the contract to the strategy
     */
    function depositAll() external virtual;

    /**
     * @dev Withdraw an amount of asset from the strategy
     * @param _recipient Recipient of asset being withdrawn
     * @param _asset Asset address
     * @param _amount Amount of asset to withdraw
     */
    function withdraw(address _recipient, address _asset, uint256 _amount) external virtual;

    /**
     * @dev Withdraw all assets from the strategy and send to the vault
     */
    function withdrawAll() external virtual;

    /**
     * @dev Get the current balance of an asset in the strategy
     * @param _asset Asset address
     * @return balance Total balance of asset currently in the strategy
     */
    function assetBalance(address _asset) external view virtual returns (uint256 balance);

    /**
     * @dev Check if the strategy supports an asset
     * @param _asset Asset address
     * @return bool `true` if asset supported, `false` otherwise
     */
    function supportsAsset(address _asset) external view virtual returns (bool);
}