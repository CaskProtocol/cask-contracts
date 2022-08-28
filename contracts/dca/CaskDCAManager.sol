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

    /** @dev map of assetSpecs that are deemed unsafe and any active DCA to them will be canceled */
    mapping(bytes32 => bool) public blacklistedAssetspecs;


    /************************** PARAMETERS **************************/

    /** @dev max number of failed DCA purchases before DCA is permanently canceled. */
    uint256 public maxSkips;

    /** @dev DCA transaction fee in basis points. */
    uint256 public dcaFeeBps;

    /** @dev Minimum DCA transaction fee. */
    uint256 public dcaFeeMin;

    /** @dev Smallest allowable DCA amount. */
    uint256 public dcaMinValue;

    /** @dev revert if price feed age is older than this number of seconds. set to 0 to disable check. */
    uint256 public maxPriceFeedAge;

    /** @dev Address to receive DCA fees. */
    address public feeDistributor;


    function initialize(
        address _caskDCA,
        address _caskVault,
        address _feeDistributor
    ) public initializer {
        caskDCA = ICaskDCA(_caskDCA);
        caskVault = ICaskVault(_caskVault);
        feeDistributor = _feeDistributor;

        maxSkips = 0;
        dcaFeeBps = 0;
        dcaFeeMin = 0;
        dcaMinValue = 0;
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

        bytes32 assetSpecHash = keccak256(abi.encode(dca.router, dca.priceFeed, dca.path));

        if (blacklistedAssetspecs[assetSpecHash]) {
            caskDCA.managerCommand(_dcaId, ICaskDCA.ManagerCommand.Cancel);
            return;
        }

        if (dca.status != ICaskDCA.DCAStatus.Active){
            return;
        }

        if (dca.amount < dcaMinValue) {
            caskDCA.managerCommand(_dcaId, ICaskDCA.ManagerCommand.Cancel);
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

        uint256 protocolFee = (amount * dcaFeeBps) / 10000;
        if (protocolFee < dcaFeeMin) {
            protocolFee = dcaFeeMin;
        }

        address inputAsset = dca.path[0];
        address outputAsset = dca.path[dca.path.length-1];

        ICaskVault.Asset memory inputAssetInfo = caskVault.getAsset(inputAsset);

        if (!inputAssetInfo.allowed) {
            scheduleWorkUnit(_queueId, _dcaId, bucketAt(dca.processAt + dca.period));
            caskDCA.managerSkipped(_dcaId, ICaskDCA.SkipReason.AssetNotAllowed);
            return;
        }

        if (!_checkMinMaxPrice(_dcaId, inputAsset, outputAsset)) {
            scheduleWorkUnit(_queueId, _dcaId, bucketAt(dca.processAt + dca.period));

            try caskVault.protocolPayment(dca.user, address(this), dcaFeeMin) {
                caskDCA.managerSkipped(_dcaId, ICaskDCA.SkipReason.OutsideLimits);
            } catch (bytes memory) {
                caskDCA.managerCommand(_dcaId, ICaskDCA.ManagerCommand.Cancel);
            }

            return;
        }

        uint256 buyQty = _processDCABuy(_dcaId, inputAsset, outputAsset, amount, protocolFee);

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
            }
        }

    }

    function _processDCABuy(
        bytes32 _dcaId,
        address _inputAsset,
        address _outputAsset,
        uint256 _amount,
        uint256 _protocolFee
    ) internal returns(uint256) {
        ICaskDCA.DCA memory dca = caskDCA.getDCA(_dcaId);

        uint256 beforeBalance = IERC20Metadata(_inputAsset).balanceOf(address(this));

        // perform a 'payment' to this contract, fee goes to vault
        try caskVault.protocolPayment(dca.user, address(this), _amount, 0) {
            // noop
        } catch (bytes memory) {
            caskDCA.managerSkipped(_dcaId, ICaskDCA.SkipReason.PaymentFailed);
            return 0;
        }

        // then withdraw the MASH received above as input asset to fund swap
        uint256 withdrawShares = caskVault.sharesForValue(_amount - _protocolFee);
        if (withdrawShares > caskVault.balanceOf(address(this))) {
            withdrawShares = caskVault.balanceOf(address(this));
        }
        caskVault.withdraw(_inputAsset, withdrawShares);

        // calculate actual amount of inputAsset that was received from payment/withdraw
        uint256 inputAmount = IERC20Metadata(_inputAsset).balanceOf(address(this)) - beforeBalance;
        require(inputAmount > 0, "!INVALID(inputAmount)");

        uint256 minOutput = _swapMinOutput(_dcaId, _inputAsset, _outputAsset, inputAmount);
        if (minOutput > 0) {
            return _performSwap(_dcaId, _inputAsset, inputAmount, minOutput);
        } else {
            return 0;
        }
    }

    function _swapMinOutput(
        bytes32 _dcaId,
        address _inputAsset,
        address _outputAsset,
        uint256 _inputAmount
    ) internal returns(uint256) {
        ICaskDCA.DCA memory dca = caskDCA.getDCA(_dcaId);
        ICaskVault.Asset memory inputAssetInfo = caskVault.getAsset(_inputAsset);

        uint256 minOutput = 0;
        if (dca.priceFeed != address(0)) {
            minOutput = _convertPrice(inputAssetInfo, _outputAsset, dca.priceFeed, _inputAmount);
        }
        uint256[] memory amountOuts = IUniswapV2Router02(dca.router).getAmountsOut(_inputAmount, dca.path);
        if (minOutput > 0) {
            minOutput = minOutput - ((minOutput * dca.slippageBps) / 10000);
            if (amountOuts[amountOuts.length-1] < minOutput) {

                // undo withdraw and send shares back to user
                IERC20Metadata(_inputAsset).safeIncreaseAllowance(address(caskVault), _inputAmount);
                caskVault.deposit(_inputAsset, _inputAmount);
                caskVault.transfer(dca.user, caskVault.balanceOf(address(this))); // refund full amount

                caskDCA.managerSkipped(_dcaId, ICaskDCA.SkipReason.ExcessiveSlippage);

                return 0;
            }
        } else {
            minOutput = amountOuts[amountOuts.length-1] - ((amountOuts[amountOuts.length-1] * dca.slippageBps) / 10000);
        }
        return minOutput;
    }

    function _performSwap(
        bytes32 _dcaId,
        address _inputAsset,
        uint256 _inputAmount,
        uint256 _minOutput
    ) internal returns(uint256) {
        ICaskDCA.DCA memory dca = caskDCA.getDCA(_dcaId);

        // let swap router spend the amount of newly acquired inputAsset
        IERC20Metadata(_inputAsset).safeIncreaseAllowance(dca.router, _inputAmount);

        // perform swap
        try IUniswapV2Router02(dca.router).swapExactTokensForTokens(
            _inputAmount,
            _minOutput,
            dca.path,
            dca.to,
            block.timestamp + 1 hours
        ) returns (uint256[] memory amounts) {
            require(amounts.length >= 2, "!INVALID(amounts)");

            // any non-withdrawn shares are the fee portion - send to fee distributor
            caskVault.transfer(feeDistributor, caskVault.balanceOf(address(this)));

            return amounts[amounts.length-1]; // last amount is final output amount
        } catch (bytes memory) {

            // undo withdraw and send shares back to user
            IERC20Metadata(_inputAsset).safeIncreaseAllowance(address(caskVault), _inputAmount);
            caskVault.deposit(_inputAsset, _inputAmount);
            caskVault.transfer(dca.user, caskVault.balanceOf(address(this))); // refund full amount

            caskDCA.managerSkipped(_dcaId, ICaskDCA.SkipReason.SwapFailed);

            return 0;
        }
    }

    function _checkMinMaxPrice(
        bytes32 _dcaId,
        address _inputAsset,
        address _outputAsset
    ) internal view returns(bool) {
        ICaskDCA.DCA memory dca = caskDCA.getDCA(_dcaId);
        ICaskVault.Asset memory inputAssetInfo = caskVault.getAsset(_inputAsset);

        if (dca.minPrice == 0 && dca.maxPrice == 0) {
            return true;
        }

        uint256 pricePerOutputUnit;
        uint8 outputAssetDecimals = IERC20Metadata(_outputAsset).decimals();
        uint256 outputAssetOneUnit = uint256(10 ** outputAssetDecimals);

        if (dca.priceFeed != address(0)) { // use price feed
            pricePerOutputUnit =
                    outputAssetOneUnit *
                    outputAssetOneUnit /
                    _convertPrice(inputAssetInfo, _outputAsset, dca.priceFeed,
                        uint256(10 ** inputAssetInfo.assetDecimals));

        } else { // use swap router price
            uint256[] memory amountOuts = IUniswapV2Router02(dca.router).getAmountsOut(
                uint256(10 ** inputAssetInfo.assetDecimals), dca.path);
            pricePerOutputUnit =
                    outputAssetOneUnit *
                    outputAssetOneUnit /
                    amountOuts[amountOuts.length-1];
        }

        if (dca.minPrice > 0 && pricePerOutputUnit < dca.minPrice) {
            return false;
        } else if (dca.maxPrice > 0 && pricePerOutputUnit > dca.maxPrice) {
            return false;
        } else {
            return true;
        }
    }

    function _convertPrice(
        ICaskVault.Asset memory _fromAsset,
        address _toAsset,
        address _toPriceFeed,
        uint256 _amount
    ) internal view returns(uint256) {
        if (_amount == 0) {
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
            return _scalePrice(_amount, _fromAsset.assetDecimals, toAssetDecimals) *
                _scalePrice(fromOraclePrice, _fromAsset.priceFeedDecimals, toAssetDecimals) /
                _scalePrice(toOraclePrice, toFeedDecimals, toAssetDecimals);
        } else {
            // oracles are already in same precision, so just scale _amount to oracle precision,
            // do the price conversion and convert back to _toAsset precision
            return _scalePrice(
                _scalePrice(_amount, _fromAsset.assetDecimals, toFeedDecimals) * fromOraclePrice / toOraclePrice,
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
        uint256 _dcaFeeBps,
        uint256 _dcaFeeMin,
        uint256 _dcaMinValue,
        uint256 _maxPriceFeedAge,
        uint32 _queueBucketSize,
        uint32 _maxQueueAge
    ) external onlyOwner {
        require(_dcaFeeBps < 10000, "!INVALID(dcaFeeBps)");

        maxSkips = _maxSkips;
        dcaFeeBps = _dcaFeeBps;
        dcaFeeMin = _dcaFeeMin;
        dcaMinValue = _dcaMinValue;
        maxPriceFeedAge = _maxPriceFeedAge;
        queueBucketSize = _queueBucketSize;
        maxQueueAge = _maxQueueAge;

        emit SetParameters();
    }

    function setFeeDistributor(
        address _feeDistributor
    ) external onlyOwner {
        feeDistributor = _feeDistributor;
        emit SetFeeDistributor(_feeDistributor);
    }

    function blacklistAssetspec(
        bytes32 _assetSpec
    ) external onlyOwner {
        blacklistedAssetspecs[_assetSpec] = true;

        emit BlacklistAssetSpec(_assetSpec);
    }

    function unblacklistAssetspec(
        bytes32 _assetSpec
    ) external onlyOwner {
        blacklistedAssetspecs[_assetSpec] = false;

        emit UnblacklistAssetSpec(_assetSpec);
    }

    function recoverFunds(
        address _asset,
        address _dest
    ) external onlyOwner {
        IERC20Metadata(_asset).transfer(_dest, IERC20Metadata(_asset).balanceOf(address(this)));
    }

}
