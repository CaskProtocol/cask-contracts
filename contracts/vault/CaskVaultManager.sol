// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


import "../interfaces/ICaskVault.sol";
import "../interfaces/ICaskStrategy.sol";
import "../interfaces/ICaskVaultManager.sol";

/**
CaskVaultOperator is where:

- the list of strategies lives
- allocation plans across strategies lives
- strategy rebalancing happen, when needed
- strategy harvesting happens
- yield and performance fees are collected and managed

*/

contract CaskVaultManager is
ICaskVaultManager,
OwnableUpgradeable,
PausableUpgradeable,
ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    /** @dev vault being managed. */
    address public vault;

    /** @dev percentage to allocate to strategies in 18 decimals. 100% = 1e18. */
    uint256 public strategyAllocationRate;

    /** @dev yield fee basis points. 2% = 200. */
    uint256 public yieldFeeBps;

    /** @dev strategist who manages the strategies. */
    address public strategist;

    // strategies available for use
    mapping(address => bool) internal strategies; // strategy contract -> enabled map
    address[] internal allStrategies;


    modifier onlyStrategist {
        require(msg.sender == strategist, "!auth");
        _;
    }


    function initialize(
        uint256 _strategyAllocationRate,
        uint256 _yieldFeeBps
    ) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        strategist = msg.sender;
        strategyAllocationRate = _strategyAllocationRate;
        yieldFeeBps = _yieldFeeBps;
    }
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}



    /************************** STRATEGY FUNCTIONS **************************/


    function getAllStrategies() public view returns(address[] memory) {
        return allStrategies;
    }

    function addStrategy(
        address _strategy
    ) external onlyOwner {
        require(!strategies[_strategy], "!added");
        strategies[_strategy] = true;
        allStrategies.push(_strategy);
        emit StrategyAdded(_strategy);
    }

    function removeStrategy(
        address _strategy
    ) external onlyOwner {
        require(strategies[_strategy], "!notfound");

        uint256 strategyIndex = allStrategies.length;
        for (uint256 i = 0; i < allStrategies.length; i++) {
            if (allStrategies[i] == _strategy) {
                strategyIndex = i;
                break;
            }
        }

        if (strategyIndex < allStrategies.length) {
            allStrategies[strategyIndex] = allStrategies[allStrategies.length - 1];
            allStrategies.pop();

            // Withdraw all from strategy
            ICaskStrategy strategy = ICaskStrategy(_strategy);
            strategy.withdrawAll();

            // Mark the asset as not allowed
            strategies[_strategy] = false;
            emit StrategyRemoved(_strategy);
        }
    }


    /************************** ADMIN FUNCTIONS **************************/

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setVault(
        address _vault
    ) external onlyOwner {
        vault = _vault;
    }

    function setStrategist(
        address _strategist
    ) external onlyOwner {
        strategist = _strategist;
    }

    function setParameters(
        uint256 _yieldFeeBps,
        uint256 _strategyAllocationRate
    ) external onlyOwner {
        yieldFeeBps = _yieldFeeBps;
        strategyAllocationRate = _strategyAllocationRate;
    }


    /************************** TOTALS FUNCTIONS **************************/


    /**
     * @dev total value of `_asset` under management
     * @param _asset Asset address
     * @return uint256 Balance of asset from all strategies
     */
    function assetBalanceManaged(address _asset) external view returns (uint256)
    {
        uint256 balance = 0;
        IERC20 asset = IERC20(_asset);
        balance = asset.balanceOf(address(this));
        for (uint256 i = 0; i < allStrategies.length; i++) {
            ICaskStrategy strategy = ICaskStrategy(allStrategies[i]);
            if (strategy.supportsAsset(_asset)) {
                balance = balance + strategy.assetBalance(_asset);
            }
        }
        return balance;
    }


    /**
     * @dev Get total value of all assets held by strategy.
     * @param _strategy Address of the strategy
     * @return value Total value in of all assets in strategy denominated in baseAsset
     */
    function totalValueInStrategy(address _strategy) public view returns (uint256) {
        uint256 value = 0;
        // TODO: get asset list from vault?
//        //FIXME: scale each asset to base asset price
//        ICaskStrategy strategy = ICaskStrategy(_strategy);
//        for (uint256 y = 0; y < allAssets.length; y++) {
//            //            uint256 assetDecimals = Helpers.getDecimals(allAssets[y]);
//            uint256 assetDecimals = 1e8;
//            if (strategy.supportsAsset(allAssets[y])) {
//                uint256 balance = strategy.assetBalance(allAssets[y]);
//                if (balance > 0) {
//                    //                    value = value + balance.scaleBy(18, assetDecimals);
//                }
//            }
//        }
        return value;
    }

    /**
     * @dev Get total value of all assets held in all strategies.
     * @return value Total value in all strategies denominated in baseAsset
     */
    function totalValueInStrategies() public view returns (uint256) {
        uint256 value = 0;
        for (uint256 i = 0; i < allStrategies.length; i++) {
            value = value + totalValueInStrategy(allStrategies[i]);
        }
        return value;
    }


    /** @dev Emitted when `_strategy` is added */
    event StrategyAdded(address indexed _strategy);

    /** @dev Emitted when `_strategy` is removed */
    event StrategyRemoved(address indexed _strategy);

}