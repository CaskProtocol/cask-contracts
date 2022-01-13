// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";


import "../interfaces/ICaskVault.sol";
import "../interfaces/ICaskVaultAdmin.sol";
import "../interfaces/ICaskStrategy.sol";

/**
CaskVault is where:

- the approved asset list lives
- users deposit/withdraw approved assets which results in a mint/burn of the vault token
- a minimum reserve rate is enforced
- vault operators can tell the vault to send unallocated assets to strategies
- protocols can process a payment between parties
- one can query the value of all unallocated assets

*/

contract CaskVault is
ICaskVault,
OwnableUpgradeable,
PausableUpgradeable,
ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    modifier onlyOperator {
        bool isOperator = false;
        for (uint256 i = 0; i < operators.length; i++) {
            if (msg.sender == operators[i]) {
                isOperator = true;
                break;
            }
        }
        require(isOperator, "!auth");
        _;
    }

    /************************** PARAMETERS **************************/

    /** @dev fixed fee to charge recipient on direct transfer, in baseAsset decimal units. */
    uint256 public transferFeeFixed;

    /** @dev percentage to charge recipient on direct transfer, in bps. 50% = 5000. */
    uint256 public transferFeeRate;



    /************************** STATE **************************/

    // address of ICaskVaultAdmin that administers the vault
    address public vaultAdmin;

    // base asset for vault - much is denominated in this
    address public baseAsset;

    // share balance handling
    mapping(address => uint256) internal balances;
    uint256 internal supply;

    // assets supported by vault
    mapping(address => Asset) internal assets;
    address[] internal allAssets;

    /** @dev total fees collected by vault - denominated in vault shares */
    uint256 public feeBalance;


    address[] public operators;

    function initialize(
        address _vaultAdmin,
        address _baseAsset
    ) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        vaultAdmin = _vaultAdmin;
        baseAsset = _baseAsset; // TODO: require price feed address in ctor? fix issues with allAssets and baseAsset

        // parameter defaults
        transferFeeFixed = 0;
        transferFeeRate = 0;

        feeBalance = 0;
    }
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}


    /**
     * @dev Pay `_baseAssetAmount` of `baseAsset` from `_from` to `_to`
     * @param _from From address
     * @param _to To address
     * @param _baseAssetAmount Amount of baseAsset to transfer
     * @param _baseAssetFee Fee to deduct from `_baseAssetAmount`
     */
    function protocolPayment(
        address _from,
        address _to,
        uint256 _baseAssetAmount,
        uint256 _baseAssetFee
    ) external override nonReentrant onlyOperator {
        uint256 shares = _sharesForAmount(_baseAssetAmount);
        require(balances[_from] >= shares, "!balance");

        uint256 feeShares = _sharesForAmount(_baseAssetFee);

        balances[_from] = balances[_from] - shares;
        balances[_to] = balances[_to] + shares - feeShares;

        feeBalance = feeBalance + feeShares; // add fee to total fees owed to protocol

        emit Payment(_from, _to, _baseAssetAmount, _baseAssetFee, shares);
    }

    function payment(
        address _to,
        uint256 _baseAssetAmount
    ) external override nonReentrant {
        uint256 shares = _sharesForAmount(_baseAssetAmount);
        require(balances[msg.sender] >= shares, "!balance");

        uint256 baseAssetFee = transferFeeFixed + (_baseAssetAmount * transferFeeRate / 10000);
        uint256 feeShares = _sharesForAmount(baseAssetFee);

        balances[msg.sender] = balances[msg.sender] - shares;
        balances[_to] = balances[_to] + shares - feeShares;

        feeBalance = feeBalance + feeShares; // add fee to total fees owed to protocol

        emit Payment(msg.sender, _to, _baseAssetAmount, baseAssetFee, shares);
    }

    /**
     * @dev Deposit an amount of `_asset` into the vault and credit the equal value of `baseAsset`
     * @param _asset Address of incoming asset
     * @param _assetAmount Amount of asset to deposit
     */
    function deposit(
        address _asset,
        uint256 _assetAmount
    ) external override nonReentrant {
        require(_asset == baseAsset || assets[_asset].allowed, "!invalid(_asset)");
        require(_assetAmount > 0, "!invalid(_assetAmount)");

        // calculate shares before transferring new asset into vault
        uint256 shares = _sharesForAmount(_assetAmount);

        IERC20(_asset).safeTransferFrom(msg.sender, address(this), _assetAmount);

        uint256 baseAssetAmount;
        if (_asset != baseAsset) {
            Asset storage asset = assets[_asset];

            // subtract slippage bps from deposited amount
            uint256 slippage = _assetAmount * asset.slippageBps / 10000;

            baseAssetAmount = _convertPrice(_asset, baseAsset, _assetAmount - slippage);
        } else {
            baseAssetAmount = _assetAmount;
        }

        supply = supply + shares;
        balances[msg.sender] = balances[msg.sender] + shares;

        emit AssetDeposited(msg.sender, _asset, _assetAmount, baseAssetAmount, shares);
    }

    /**
     * @dev Withdraw an amount of shares from the vault in the form of `_asset`
     * @param _recipient Recipient who will receive the withdrawn assets
     * @param _asset Address of outgoing asset
     * @param _shares Amount of shares to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _shares
    ) external override nonReentrant {
        require(assets[_asset].allowed, "!invalid(_asset)");
        require(_shares > 0, "!invalid(_sharesAmount)");

        require(balances[msg.sender] >= _shares, "!balance");

        // calculate amount before supply adjustment
        uint256 baseAmount = _shareValue(_shares);

        supply = supply - _shares;
        balances[msg.sender] = balances[msg.sender] - _shares;

        uint256 assetAmount;
        if (_asset != baseAsset) {
            Asset storage asset = assets[_asset];

            assetAmount = _convertPrice(baseAsset, _asset, baseAmount);

            // subtract slippage bps from withdrawing amount
            uint256 slippage = assetAmount * asset.slippageBps / 10000;
            assetAmount = assetAmount - slippage;
        } else {
            assetAmount = baseAmount;
        }

        // transfer requested stablecoin to _recipient
        IERC20(_asset).safeTransfer(_recipient, assetAmount);

        emit AssetWithdrawn(_recipient, _asset, assetAmount, baseAmount, _shares);
    }

    function totalSupply() external override view returns(uint256) {
        return supply;
    }

    function balanceOf(
        address _address
    ) external override view returns(uint256) {
        return balances[_address];
    }

    function currentValueOf(
        address _address
    ) external override view returns(uint256) {
        return _shareValue(balances[_address]);
    }

    /************************** SHARES FUNCTIONS **************************/

    function _sharesForAmount(
        uint256 _amount
    ) internal view returns(uint256) {
        if (_totalValue() > 0) {
            return _amount * supply / _totalValue();
        } else {
            return _amount;
        }
    }

    function _shareValue(
        uint256 _shares
    ) internal view returns(uint256) {
        if (supply == 0) {
            return _shares;
        }
        return _shares * _totalValue() / supply;
    }


    function totalValue() external override view returns(uint256) {
        return _totalValue();
    }
    function _totalValue() internal view returns(uint256) {
        uint256 total = 0;

        for (uint256 i = 0; i < allAssets.length; i++) {
            if (allAssets[i] == baseAsset) {
                total = total + _totalAssetBalance(baseAsset);
            } else {
                total = total + _convertPrice(allAssets[i], baseAsset, _totalAssetBalance(allAssets[i]));
            }
        }

        return total;
    }
    function totalAssetBalance(
        address _asset
    ) external override view returns(uint256) {
        return _totalAssetBalance(_asset);
    }
    function _totalAssetBalance(
        address _asset
    ) internal view returns(uint256) {
        return IERC20(_asset).balanceOf(address(this)) + ICaskVaultAdmin(vaultAdmin).assetBalanceManaged(_asset);
    }

    function allocateToStrategy(
        address _strategy,
        address _asset,
        uint256 _assetAmount
    ) external override onlyOperator {
        require(assets[_asset].allowed, "!allowed");
        IERC20(_asset).safeTransfer(_strategy, _assetAmount);
        emit AllocatedToStrategy(_strategy, _asset, _assetAmount);
    }


    /************************** ADMIN FUNCTIONS **************************/

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function addOperator(
        address _operator
    ) external onlyOwner {
        operators.push(_operator);
    }

    function removeOperator(
        address _operator
    ) external onlyOwner {
        uint256 idx = operators.length;
        for (uint256 i = 0; i < operators.length; i++) {
            if (operators[i] == _operator) {
                idx = i;
                break;
            }
        }
        if (idx < operators.length) {
            operators[idx] = operators[operators.length - 1];
            operators.pop();
        }
    }

    function operatorCount() external view returns(uint256) {
        return operators.length;
    }

    /**
    * @dev Withdraw an amount of accumulated share fees in the form of `baseAsset`
     * @param _recipient Recipient who will receive the withdrawn assets
     * @param _sharesAmount Amount of shares to withdraw
     */
    function withdrawFees(
        address _recipient,
        uint256 _sharesAmount
    ) external onlyOwner {
        require(_sharesAmount <= feeBalance, "!balance");

        // calculate amount before supply adjustment
        uint256 baseAmount = _shareValue(_sharesAmount);

        supply = supply - _sharesAmount; // reduce supply
        feeBalance = feeBalance - _sharesAmount; // reduce owed fees

        // transfer fees in the form of baseAsset to _recipient
        IERC20(baseAsset).safeTransfer(_recipient, baseAmount);

        emit AssetWithdrawn(_recipient, baseAsset, baseAmount, baseAmount, _sharesAmount);
    }

    function setParameters(
        uint256 _transferFeeFixed,
        uint256 _transferFeeRate
    ) external onlyOwner {
        transferFeeFixed = _transferFeeFixed;
        transferFeeRate = _transferFeeRate;
    }


    /************************** ASSET FUNCTIONS **************************/

    function setBaseAsset(
        address _baseAsset
    ) external onlyOwner {
        baseAsset = _baseAsset;
    }

    function getBaseAsset() external view override returns(address) {
        return baseAsset;
    }

    function getAllAssets() external view override returns(address[] memory) {
        return allAssets;
    }

    function getAsset(
        address _asset
    ) external view override returns(Asset memory) {
        return assets[_asset];
    }

    /**
     * @dev Check if the vault supports an asset
     * @param _asset Asset address
     * @return bool `true` if asset supported, `false` otherwise
     */
    function supportsAsset(
        address _asset
    ) external view override returns (bool) {
        return assets[_asset].allowed;
    }

    /**
     * @dev Add an allowed asset to be deposited into the vault
     * @param _asset Address of new ERC20 asset
     * @param _priceFeed Address of a chainlink-compatible price oracle for the asset
     * @param _slippageBps Slippage basis points to use when depositing/withdrawing this asset
     */
    function allowAsset(
        address _asset,
        address _priceFeed,
        uint256 _depositLimit,
        uint256 _slippageBps
    ) external onlyOwner {
        require(IERC20Metadata(_asset).decimals() > 0, "!invalid(_asset)");
        require(AggregatorV3Interface(_priceFeed).decimals() > 0, "!invalid(_priceFeed)");

        Asset storage asset = assets[_asset];
        asset.priceFeed = _priceFeed;
        asset.depositLimit = _depositLimit;
        asset.slippageBps = _slippageBps;

        asset.assetDecimals = IERC20Metadata(_asset).decimals();
        asset.priceFeedDecimals = AggregatorV3Interface(_priceFeed).decimals();

        if (!asset.allowed) {
            asset.allowed = true;
            allAssets.push(_asset); // just once
        }

        emit AllowedAsset(_asset);
    }

    function convertPrice(
        address _fromAsset,
        address _toAsset,
        uint256 _fromAmount
    ) external view returns(uint256) {
        return _convertPrice(_fromAsset, _toAsset, _fromAmount);
    }

    /**
     * @dev Convert _amount from one asset price to another
     */
    function _convertPrice(
        address _fromAsset,
        address _toAsset,
        uint256 _fromAmount
    ) internal view returns(uint256) {
        require(_fromAsset != _toAsset, "!invalid");
        require(assets[_fromAsset].allowed, "!invalid(_fromAsset)");
        require(assets[_toAsset].allowed, "!invalid(_toAsset)");

        if (_fromAmount == 0) {
            return 0;
        }

        int256 oraclePrice;

        ( , oraclePrice, , , ) = AggregatorV3Interface(assets[_fromAsset].priceFeed).latestRoundData();
        uint256 fromOraclePrice = uint256(oraclePrice);
        ( , oraclePrice, , , ) = AggregatorV3Interface(assets[_toAsset].priceFeed).latestRoundData();
        uint256 toOraclePrice = uint256(oraclePrice);

        if (assets[_fromAsset].priceFeedDecimals != assets[_toAsset].priceFeedDecimals) {
            // since oracle precision is different, scale everything
            // to _toAsset precision and do conversion
            return _scalePrice(_fromAmount, assets[_fromAsset].assetDecimals, assets[_toAsset].assetDecimals) *
                    _scalePrice(fromOraclePrice, assets[_fromAsset].priceFeedDecimals, assets[_toAsset].assetDecimals) /
                    _scalePrice(toOraclePrice, assets[_toAsset].priceFeedDecimals, assets[_toAsset].assetDecimals);
        } else {
            // oracles are already in same precision, so just scale _amount to oracle precision,
            // do the price conversion and convert back to _toAsset precision
            return _scalePrice(
                    _scalePrice(_fromAmount, assets[_fromAsset].assetDecimals, assets[_toAsset].priceFeedDecimals) *
                            fromOraclePrice / toOraclePrice,
                        assets[_toAsset].priceFeedDecimals,
                        assets[_toAsset].assetDecimals
            );
        }
    }

    function _scalePrice(
        uint256 _price,
        uint8 _priceDecimals,
        uint8 _decimals
    ) internal pure returns (uint256){
        if (_priceDecimals < _decimals) {
            return _price * uint256(10 ** uint256(_decimals - _priceDecimals));
        } else if (_priceDecimals > _decimals) {
            return _price / uint256(10 ** uint256(_priceDecimals - _decimals));
        }
        return _price;
    }

}