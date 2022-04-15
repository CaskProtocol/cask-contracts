// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "@opengsn/contracts/src/BaseRelayRecipient.sol";


import "../interfaces/ICaskVault.sol";
import "../interfaces/ICaskVaultManager.sol";
import "../interfaces/ICaskStrategy.sol";

/**
CaskVault is where:

- the approved asset list lives
- users deposit/withdraw approved assets which results in a mint/burn of the vault token
- a minimum reserve rate is enforced
- vault manager can tell the vault to send unallocated assets to strategies
- approved protocols can process a payment between parties
- one can query the value of all unallocated assets

*/

contract CaskVault is
ICaskVault,
BaseRelayRecipient,
ERC20Upgradeable,
OwnableUpgradeable,
PausableUpgradeable,
ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    modifier onlyProtocol {
        bool isProtocol = false;
        for (uint256 i = 0; i < protocols.length; i++) {
            if (_msgSender() == protocols[i]) {
                isProtocol = true;
                break;
            }
        }
        require(isProtocol, "!AUTH");
        _;
    }


    /************************** STATE **************************/

    // address of ICaskVaultManager that manages the vault
    address public vaultManager;

    // base asset for vault - much is denominated in this
    address public baseAsset;

    // address of contract that collects and distributes fees
    address public feeDistributor;

    // assets supported by vault
    mapping(address => Asset) internal assets;
    address[] internal allAssets;

    address[] public protocols;

    function initialize(
        address _vaultManager,
        address _baseAsset,
        address _baseAssetPriceFeed,
        address _feeDistributor
    ) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __ERC20_init("Cask Vault Tokens","MASH");

        require(IERC20Metadata(_baseAsset).decimals() > 0, "!INVALID(baseAsset)");
        require(AggregatorV3Interface(_baseAssetPriceFeed).decimals() > 0, "!INVALID(baseAssetPriceFeed)");

        Asset storage asset = assets[_baseAsset];
        asset.priceFeed = _baseAssetPriceFeed;
        asset.assetDecimals = IERC20Metadata(_baseAsset).decimals();
        asset.priceFeedDecimals = AggregatorV3Interface(_baseAssetPriceFeed).decimals();
        asset.slippageBps = 0;
        asset.allowed = true;
        allAssets.push(_baseAsset);

        vaultManager = _vaultManager;
        baseAsset = _baseAsset;
        feeDistributor = _feeDistributor;
    }
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function versionRecipient() public pure override returns(string memory) { return "2.2.0"; }

    function _msgSender() internal view override(ContextUpgradeable, BaseRelayRecipient)
    returns (address sender) {
        sender = BaseRelayRecipient._msgSender();
    }

    function _msgData() internal view override(ContextUpgradeable, BaseRelayRecipient)
    returns (bytes memory) {
        return BaseRelayRecipient._msgData();
    }


    /**
     * @dev Pay `_value` of `baseAsset` from `_from` to `_to` initiated by an authorized protocol
     * @param _from From address
     * @param _to To address
     * @param _value Amount of baseAsset value to transfer
     * @param _protocolFee Protocol fee to deduct from `_value`
     * @param _network Address of network fee collector
     * @param _networkFee Network fee to deduct from `_value`
     */
    function protocolPayment(
        address _from,
        address _to,
        uint256 _value,
        uint256 _protocolFee,
        address _network,
        uint256 _networkFee
    ) external override nonReentrant onlyProtocol {
        _protocolPayment(_from, _to, _value, _protocolFee, _network, _networkFee);
    }

    /**
     * @dev Pay `_value` of `baseAsset` from `_from` to `_to` initiated by an authorized protocol
     * @param _from From address
     * @param _to To address
     * @param _value Amount of baseAsset value to transfer
     * @param _protocolFee Protocol fee to deduct from `_value`
     */
    function protocolPayment(
        address _from,
        address _to,
        uint256 _value,
        uint256 _protocolFee
    ) external override nonReentrant onlyProtocol {
        _protocolPayment(_from, _to, _value, _protocolFee, address(0), 0);
    }

    /**
     * @dev Pay `_value` of `baseAsset` from `_from` to `_to` initiated by an authorized protocol
     * @param _from From address
     * @param _to To address
     * @param _value Amount of baseAsset value to transfer
     */
    function protocolPayment(
        address _from,
        address _to,
        uint256 _value
    ) external override nonReentrant onlyProtocol {
        _protocolPayment(_from, _to, _value, 0, address(0), 0);
    }

    function _protocolPayment(
        address _from,
        address _to,
        uint256 _value,
        uint256 _protocolFee,
        address _network,
        uint256 _networkFee
    ) internal {
        uint256 shares = _sharesForValue(_value);

        uint256 protocolFeeShares = 0;
        if (_protocolFee > 0) {
            protocolFeeShares = _sharesForValue(_protocolFee);
        }

        uint256 networkFeeShares = 0;
        if (_networkFee > 0 && _network != address(0)) {
            networkFeeShares = _sharesForValue(_networkFee);
        }

        _transfer(_from, _to, shares); // payment from consumer to provider

        if (protocolFeeShares > 0) {
            _transfer(_to, feeDistributor, protocolFeeShares); // fee from provider to fee distributor
        }
        if (networkFeeShares > 0) {
            _transfer(_to, _network, networkFeeShares); // network fee from provider to network
        }

        emit Payment(_from, _to, _value, shares, _protocolFee, protocolFeeShares, _network,
            _networkFee, networkFeeShares);
    }

    function transferValue(
        address _recipient,
        uint256 _value
    ) external override nonReentrant returns (bool) {
        uint256 amount = _sharesForValue(_value);
        _transfer(_msgSender(), _recipient, amount);
        emit TransferValue(_msgSender(), _recipient, _value, amount);
        return true;
    }

    function transferValueFrom(
        address _sender,
        address _recipient,
        uint256 _value
    ) external override nonReentrant returns (bool) {
        uint256 amount = _sharesForValue(_value);
        _transfer(_sender, _recipient, amount);

        uint256 currentAllowance = allowance(_sender, _msgSender());
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        unchecked {
            _approve(_sender, _msgSender(), currentAllowance - amount);
        }
        emit TransferValue(_sender, _recipient, _value, amount);
        return true;
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
        _depositTo(_msgSender(), _asset, _assetAmount);
    }

    /**
     * @dev Deposit an amount of `_asset` into the vault and credit the equal value of `baseAsset`
     * @param _to Recipient of funds
     * @param _asset Address of incoming asset
     * @param _assetAmount Amount of asset to deposit
     */
    function depositTo(
        address _to,
        address _asset,
        uint256 _assetAmount
    ) external override nonReentrant {
        _depositTo(_to, _asset, _assetAmount);
    }

    function _depositTo(
        address _to,
        address _asset,
        uint256 _assetAmount
    ) internal {
        require(assets[_asset].allowed, "!NOT_ALLOWED(asset)");
        require(_assetAmount > 0, "!INVALID(assetAmount)");

        uint256 baseAssetAmount = _assetAmount;
        if (_asset != baseAsset) {
            Asset storage asset = assets[_asset];

            // subtract slippage bps from deposited amount
            uint256 slippage = (_assetAmount * asset.slippageBps) / 10000;

            baseAssetAmount = _convertPrice(_asset, baseAsset, (_assetAmount - slippage));
        }

        // calculate shares before transferring new asset into vault
        uint256 shares = _sharesForValue(baseAssetAmount);

        IERC20(_asset).safeTransferFrom(_msgSender(), address(this), _assetAmount);

        _mint(_to, shares);

        emit AssetDeposited(_to, _asset, _assetAmount, baseAssetAmount, shares);
    }

    /**
     * @dev Withdraw an amount of shares from the vault in the form of `_asset`
     * @param _asset Address of outgoing asset
     * @param _shares Amount of shares to withdraw
     */
    function withdraw(
        address _asset,
        uint256 _shares
    ) external override nonReentrant {
        _withdrawTo(_msgSender(), _asset, _shares);
    }

    /**
     * @dev Withdraw an amount of shares from the vault in the form of `_asset`
     * @param _recipient Recipient who will receive the withdrawn assets
     * @param _asset Address of outgoing asset
     * @param _shares Amount of shares to withdraw
     */
    function withdrawTo(
        address _recipient,
        address _asset,
        uint256 _shares
    ) external override nonReentrant {
        _withdrawTo(_recipient, _asset, _shares);
    }

    function _withdrawTo(
        address _recipient,
        address _asset,
        uint256 _shares
    ) internal {
        require(assets[_asset].allowed, "!NOT_ALLOWED(asset)");
        require(_shares > 0, "!INVALID(sharesAmount)");

        // calculate amount before supply adjustment
        uint256 baseAmount = _shareValue(_shares);

        _burn(_msgSender(), _shares);

        uint256 assetAmount = baseAmount;
        if (_asset != baseAsset) {
            Asset storage asset = assets[_asset];

            assetAmount = _convertPrice(baseAsset, _asset, baseAmount);

            // subtract slippage bps from withdrawing amount
            uint256 slippage = (assetAmount * asset.slippageBps) / 10000;
            assetAmount = assetAmount - slippage;
        }

        // transfer requested stablecoin to _recipient
        IERC20(_asset).safeTransfer(_recipient, assetAmount);

        emit AssetWithdrawn(_recipient, _asset, assetAmount, baseAmount, _shares);
    }

    function currentValueOf(
        address _address
    ) external override view returns(uint256) {
        return _shareValue(balanceOf(_address));
    }

    function pricePerShare() external override view returns(uint256) {
        return _shareValue(10 ** assets[baseAsset].assetDecimals);
    }

    /************************** SHARES FUNCTIONS **************************/

    function _sharesForValue(
        uint256 _amount
    ) internal view returns(uint256) {
        if (totalSupply() > 0) {
            return (_amount * totalSupply()) / _totalValue();
        } else {
            return _amount;
        }
    }

    function _shareValue(
        uint256 _shares
    ) internal view returns(uint256) {
        if (totalSupply() == 0) {
            return _shares;
        }
        return (_shares * _totalValue()) / totalSupply();
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
        return IERC20(_asset).balanceOf(address(this)) + ICaskVaultManager(vaultManager).assetBalanceManaged(_asset);
    }

    function allocateToStrategy(
        address _strategy,
        address _asset,
        uint256 _assetAmount
    ) external override onlyProtocol {
        require(assets[_asset].allowed, "!NOT_ALLOWED(asset)");
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

    function addProtocol(
        address _protocol
    ) external onlyOwner {
        protocols.push(_protocol);
    }

    function removeProtocol(
        address _protocol
    ) external onlyOwner {
        uint256 idx = protocols.length;
        for (uint256 i = 0; i < protocols.length; i++) {
            if (protocols[i] == _protocol) {
                idx = i;
                break;
            }
        }
        if (idx < protocols.length) {
            protocols[idx] = protocols[protocols.length - 1];
            protocols.pop();
        }
    }

    function protocolCount() external view returns(uint256) {
        return protocols.length;
    }

    function setFeeDistributor(
        address _feeDistributor
    ) external onlyOwner {
        feeDistributor = _feeDistributor;
    }

    function setManager(
        address _vaultManager
    ) external onlyOwner {
        vaultManager = _vaultManager;
    }

    function setTrustedForwarder(
        address _forwarder
    ) external onlyOwner {
        _setTrustedForwarder(_forwarder);
    }


    /************************** ASSET FUNCTIONS **************************/

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
        require(IERC20Metadata(_asset).decimals() > 0, "!INVALID(asset)");
        require(AggregatorV3Interface(_priceFeed).decimals() > 0, "!INVALID(priceFeed)");

        Asset storage asset = assets[_asset];

        // add to allAsset list just the first time
        if (asset.assetDecimals == 0) {
            allAssets.push(_asset);
        }

        asset.allowed = true;
        asset.priceFeed = _priceFeed;
        asset.depositLimit = _depositLimit;
        asset.slippageBps = _slippageBps;
        asset.assetDecimals = IERC20Metadata(_asset).decimals();
        asset.priceFeedDecimals = AggregatorV3Interface(_priceFeed).decimals();

        emit AllowedAsset(_asset);
    }

    /**
     * @dev Mark an already allowed asset to no longer be allowed for deposits/withdraws
     * @param _asset Address of new ERC20 asset
     */
    function disallowAsset(
        address _asset
    ) external onlyOwner {
        require(assets[_asset].allowed, "!ASSET_NOT_ALLOWED");

        assets[_asset].allowed = false;

        emit DisallowedAsset(_asset);
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
        require(_fromAsset != _toAsset, "!SAME_ASSET");
        require(assets[_fromAsset].priceFeed != address(0), "!INVALID(fromAsset)");
        require(assets[_toAsset].priceFeed != address(0), "!NOT_ALLOWED(toAsset)");

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