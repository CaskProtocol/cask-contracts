// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import "../job_queue/CaskJobQueue.sol";
import "../interfaces/ICaskDCAManager.sol";
import "../interfaces/ICaskDCA.sol";
import "../interfaces/ICaskVault.sol";

contract CaskDCAManager is
Initializable,
ReentrancyGuardUpgradeable,
CaskJobQueue,
ICaskDCAManager
{
    using SafeERC20 for IERC20Metadata;

    uint8 private constant QUEUE_ID_DCA = 1;


    /** @dev Pointer to CaskDCA contract */
    ICaskDCA public caskDCA;

    /** @dev vault to use for DCA funding. */
    ICaskVault public caskVault;

    /** @dev merkle root of allowed assets definitions. */
    bytes32 public assetsMerkleRoot;

    /** @dev map of swap routers that are deemed unsafe and any active DCA to them will be canceled */
    mapping(address => bool) public blacklistedRouters;


    /************************** PARAMETERS **************************/

    /** @dev max number of failed DCA purchases before DCA is permanently canceled. */
    uint256 public maxSkips;

    /** @dev DCA transaction fee in basis points. */
    uint256 public feeBps;

    /** @dev revert if price feed age is older than this number of seconds. set to 0 to disable check. */
    uint256 public maxPriceFeedAge;


    function initialize(
        address _caskDCA,
        address _caskVault
    ) public initializer {
        caskDCA = ICaskDCA(_caskDCA);
        caskVault = ICaskVault(_caskVault);

        maxSkips = 0;
        feeBps = 0;
        maxPriceFeedAge = 0;

        __CaskJobQueue_init(3600);
    }
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function registerDCA(
        bytes32 _dcaId
    ) override external nonReentrant whenNotPaused {
        processWorkUnit(QUEUE_ID_DCA, _dcaId);
    }

    function processWorkUnit(
        uint8 _queueId,
        bytes32 _dcaId
    ) override internal {

        ICaskDCA.DCA memory dca = caskDCA.getDCA(_dcaId);

        if (blacklistedRouters[dca.router]) {
            caskDCA.managerCommand(_dcaId, ICaskDCA.ManagerCommand.Cancel);
            return;
        }

        if (dca.status != ICaskDCA.DCAStatus.Active){
            return;
        }

        uint32 timestamp = uint32(block.timestamp);

        // not time to process yet, re-queue for processAt time
        if (dca.processAt > timestamp) {
            scheduleWorkUnit(_queueId, _dcaId, bucketAt(dca.processAt));
            return;
        }

        uint256 amount = dca.amount;
        if (dca.totalAmount > 0 && amount > dca.totalAmount - dca.currentAmount) {
            amount = dca.totalAmount - dca.currentAmount;
        }
        uint256 protocolFee = (amount * feeBps) / 10000;
        uint256 buyQty = _processDCABuy(dca, amount, protocolFee);

        // did a swap happen successfully?
        if (buyQty > 0) {

            if (dca.totalAmount == 0 || dca.currentAmount + amount < dca.totalAmount) {
                scheduleWorkUnit(_queueId, _dcaId, bucketAt(dca.processAt + dca.period));
            }

            caskDCA.managerProcessed(_dcaId, amount, buyQty, protocolFee);

        } else {
            if (maxSkips > 0 && dca.numSkips >= maxSkips) {
                caskDCA.managerCommand(_dcaId, ICaskDCA.ManagerCommand.Pause);
            } else {
                scheduleWorkUnit(_queueId, _dcaId, bucketAt(dca.processAt + dca.period));

                caskDCA.managerCommand(_dcaId, ICaskDCA.ManagerCommand.Skip);
            }
        }

    }

    function _processDCABuy(
        ICaskDCA.DCA memory _dca,
        uint256 _amount,
        uint256 _protocolFee
    ) internal returns(uint256) {

        address inputAsset = _dca.path[0];
        address outputAsset = _dca.path[_dca.path.length-1];

        ICaskVault.Asset memory inputAssetInfo = caskVault.getAsset(inputAsset);
        require(inputAssetInfo.allowed, "!INVALID(inputAsset)");

        _ensureMinMaxPrice(_dca, inputAssetInfo, outputAsset, _dca.priceFeed);

        uint256 beforeBalance = IERC20Metadata(inputAsset).balanceOf(address(this));

        // perform a 'payment' to this contract, fee goes to vault
        try caskVault.protocolPayment(_dca.user, address(this), _amount, _protocolFee) {
            // noop
        } catch (bytes memory) {
            return 0;
        }

        // then withdraw the MASH received above as input asset to fund swap
        uint256 withdrawShares = caskVault.sharesForValue(_amount - _protocolFee);
        if (withdrawShares > caskVault.balanceOf(address(this))) {
            withdrawShares = caskVault.balanceOf(address(this));
        }
        try caskVault.withdraw(inputAsset, withdrawShares) {
            // noop
        } catch (bytes memory) {
            return 0;
        }

        // calculate actual amount of inputAsset that was received from payment/withdraw
        uint256 amountIn = IERC20Metadata(inputAsset).balanceOf(address(this)) - beforeBalance;
        require(amountIn > 0, "!INVALID(amountIn)");

        // let swap router spend the amount of newly acquired inputAsset
        IERC20Metadata(inputAsset).safeIncreaseAllowance(_dca.router, amountIn);

        uint256 optimalOutput = _convertPrice(inputAssetInfo, outputAsset, _dca.priceFeed, amountIn);

        // perform swap
        try IUniswapV2Router02(_dca.router).swapExactTokensForTokens(
            amountIn,
            optimalOutput - ((optimalOutput * _dca.slippageBps) / 10000), // adjust for slippage
            _dca.path,
            _dca.to,
            block.timestamp + 1 hours
        ) returns (uint256[] memory amounts) {
            require(amounts.length >= 2, "!INVALID(amounts)");
            return amounts[amounts.length-1]; // last amount is final output amount
        } catch (bytes memory) {
            return 0;
        }
    }

    function _ensureMinMaxPrice(
        ICaskDCA.DCA memory _dca,
        ICaskVault.Asset memory _inputAssetInfo,
        address _outputAsset,
        address _outputPriceFeed
    ) internal view {
        uint256 inputAssetOneUnit = uint256(10 ** _inputAssetInfo.assetDecimals);
        uint256 pricePerOutputUnit =  inputAssetOneUnit /
                _convertPrice(_inputAssetInfo, _outputAsset, _outputPriceFeed, inputAssetOneUnit);
        require(_dca.minPrice == 0 || _dca.minPrice > pricePerOutputUnit, "!MIN_PRICE");
        require(_dca.maxPrice == 0 || _dca.maxPrice < pricePerOutputUnit, "!MAX_PRICE");
    }

    function _convertPrice(
        ICaskVault.Asset memory _fromAsset,
        address _toAsset,
        address _toPriceFeed,
        uint256 amount
    ) internal view returns(uint256) {
        if (amount == 0) {
            return 0;
        }

        int256 oraclePrice;
        uint256 updatedAt;

        uint8 toAssetDecimals = IERC20Metadata(_toAsset).decimals();
        uint8 toFeedDecimals = AggregatorV3Interface(_toPriceFeed).decimals();
        
        ( , oraclePrice, , updatedAt, ) = AggregatorV3Interface(_fromAsset.priceFeed).latestRoundData();
        uint256 fromOraclePrice = uint256(oraclePrice);
        require(maxPriceFeedAge == 0 || block.timestamp - updatedAt <= maxPriceFeedAge, "!PRICE_OUTDATED");
        ( , oraclePrice, , updatedAt, ) = AggregatorV3Interface(_toPriceFeed).latestRoundData();
        uint256 toOraclePrice = uint256(oraclePrice);
        require(maxPriceFeedAge == 0 || block.timestamp - updatedAt <= maxPriceFeedAge, "!PRICE_OUTDATED");

        if (_fromAsset.priceFeedDecimals != toFeedDecimals) {
            // since oracle precision is different, scale everything
            // to _toAsset precision and do conversion
            return _scalePrice(amount, _fromAsset.assetDecimals, toAssetDecimals) *
                _scalePrice(fromOraclePrice, _fromAsset.priceFeedDecimals, toAssetDecimals) /
                _scalePrice(toOraclePrice, toFeedDecimals, toAssetDecimals);
        } else {
            // oracles are already in same precision, so just scale _amount to oracle precision,
            // do the price conversion and convert back to _toAsset precision
            return _scalePrice(
                _scalePrice(amount, _fromAsset.assetDecimals, toFeedDecimals) * fromOraclePrice / toOraclePrice,
                    toFeedDecimals,
                    toAssetDecimals
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

    function setParameters(
        uint256 _maxSkips,
        uint256 _feeBps,
        uint256 _maxPriceFeedAge,
        uint32 _queueBucketSize
    ) external onlyOwner {
        maxSkips = _maxSkips;
        feeBps = _feeBps;
        maxPriceFeedAge = _maxPriceFeedAge;
        queueBucketSize = _queueBucketSize;
    }

    function blacklistRouter(
        address _router
    ) external onlyOwner {
        blacklistedRouters[_router] = true;
    }

    function unblacklistRouter(
        address _router
    ) external onlyOwner {
        blacklistedRouters[_router] = false;
    }
}