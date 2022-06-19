// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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
    using SafeERC20 for IERC20;

    uint256 private constant QUEUE_ID_DCA = 3;


    /** @dev Pointer to CaskDCA contract */
    ICaskDCA public caskDCA;

    /** @dev vault to use for DCA funding. */
    ICaskVault public caskVault;

    /** @dev merkle root of allowed assets definitions. */
    bytes32 public assetsMerkleRoot;

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
        uint256 _queueId,
        bytes32 _dcaId
    ) override internal {

        ICaskDCA.DCA memory dca = caskDCA.getDCA(_dcaId);

        uint32 timestamp = uint32(block.timestamp);

        if (dca.status == ICaskDCA.DCAStatus.Paused ||
            dca.status == ICaskDCA.DCAStatus.Canceled ||
            dca.status == ICaskDCA.DCAStatus.None)
        {
            return;
        }

        // not time to process yet, re-queue for processAt time
        if (dca.processAt > timestamp) {
            scheduleWorkUnit(_queueId, _dcaId, bucketAt(dca.processAt));
            return;
        }

        if (dca.completeAt > 0 && dca.completeAt <= timestamp) {
            caskDCA.managerCommand(_dcaId, ICaskDCA.ManagerCommand.Complete);
            return;
        }

        uint256 purchaseAmount = _processDCABuy(dca);

        if (purchaseAmount > 0) {
            scheduleWorkUnit(_queueId, _dcaId, bucketAt(dca.processAt + dca.period));

            caskDCA.managerProcessed(_dcaId, purchaseAmount);

        } else {
            if (dca.numSkips >= maxSkips) {
                caskDCA.managerCommand(_dcaId, ICaskDCA.ManagerCommand.Pause);
            } else {
                scheduleWorkUnit(_queueId, _dcaId, bucketAt(dca.processAt + dca.period));

                caskDCA.managerCommand(_dcaId, ICaskDCA.ManagerCommand.Skip);
            }
        }

    }

    function _processDCABuy(
        ICaskDCA.DCA memory _dca
    ) internal returns(uint256) {

        ICaskVault.Asset memory fromAsset = caskVault.getAsset(_dca.inputAsset);

        // protocol fee for DCA buy (does not include fee charged by swap router)
        uint256 protocolFee = (_dca.amount * feeBps) / 10000;

        uint256 beforeBalance = IERC20(_dca.inputAsset).balanceOf(address(this));

        // perform a 'payment' to this contract, fee goes to vault
        caskVault.protocolPayment(_dca.user, address(this), _dca.amount, protocolFee);

        // then withdraw the MASH received above as input asset to fund swap
        caskVault.withdraw(_dca.inputAsset, caskVault.sharesForValue(_dca.amount - protocolFee));

        // calculate actual amount of inputAsset that was received from payment/withdraw
        uint256 amountIn = IERC20(_dca.inputAsset).balanceOf(address(this)) - beforeBalance;

        // let swap router spend the amount of newly acquired inputAsset
        IERC20(_dca.inputAsset).safeIncreaseAllowance(_dca.router, amountIn);

        uint256 inputAssetOneUnit = uint256(10 ** fromAsset.assetDecimals);
        uint256 pricePerOutputUnit =  inputAssetOneUnit / _convertPrice(fromAsset, _dca, inputAssetOneUnit);
        require(_dca.minPrice == 0 || _dca.minPrice > pricePerOutputUnit, "!MIN_PRICE");
        require(_dca.maxPrice == 0 || _dca.maxPrice < pricePerOutputUnit, "!MAX_PRICE");

        uint256 optimalOutput = _convertPrice(fromAsset, _dca, amountIn);
        uint256 amountOutMin = optimalOutput - ((optimalOutput * _dca.slippageBps) / 10000);

        address[] memory path = new address[](2);
        path[0] = _dca.inputAsset;
        path[1] = _dca.outputAsset;

        // perform swap
        try IUniswapV2Router02(_dca.router).swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            _dca.user,
            block.timestamp + 1 hours
        ) returns (uint256[] memory amounts) {
            return amounts[amounts.length-1]; // last amount is final output amount
        } catch (bytes memory) {
            return 0;
        }
    }

    function _convertPrice(
        ICaskVault.Asset memory _fromAsset,
        ICaskDCA.DCA memory _dca,
        uint256 amount
    ) internal view returns(uint256) {
        require(_fromAsset.priceFeed != address(0), "!INVALID(inputAsset)");
        require(_dca.priceFeed != address(0), "!INVALID(outputAsset)");

        if (amount == 0) {
            return 0;
        }

        int256 oraclePrice;
        uint256 updatedAt;

        ( , oraclePrice, , updatedAt, ) = AggregatorV3Interface(_fromAsset.priceFeed).latestRoundData();
        uint256 fromOraclePrice = uint256(oraclePrice);
        require(maxPriceFeedAge == 0 || block.timestamp - updatedAt <= maxPriceFeedAge, "!PRICE_OUTDATED");
        ( , oraclePrice, , updatedAt, ) = AggregatorV3Interface(_dca.priceFeed).latestRoundData();
        uint256 toOraclePrice = uint256(oraclePrice);
        require(maxPriceFeedAge == 0 || block.timestamp - updatedAt <= maxPriceFeedAge, "!PRICE_OUTDATED");

        if (_fromAsset.priceFeedDecimals != _dca.priceFeedDecimals) {
            // since oracle precision is different, scale everything
            // to _toAsset precision and do conversion
            return _scalePrice(amount, _fromAsset.assetDecimals, _dca.assetDecimals) *
                _scalePrice(fromOraclePrice, _fromAsset.priceFeedDecimals, _dca.assetDecimals) /
                _scalePrice(toOraclePrice, _dca.priceFeedDecimals, _dca.assetDecimals);
        } else {
            // oracles are already in same precision, so just scale _amount to oracle precision,
            // do the price conversion and convert back to _toAsset precision
            return _scalePrice(
                _scalePrice(amount, _fromAsset.assetDecimals, _dca.priceFeedDecimals) * fromOraclePrice / toOraclePrice,
                _dca.priceFeedDecimals,
                _dca.assetDecimals
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
}
