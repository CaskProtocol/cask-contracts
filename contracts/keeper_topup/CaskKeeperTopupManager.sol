// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import "../interfaces/ICaskVault.sol";
import "../job_queue/CaskJobQueue.sol";
import "./ICaskKeeperTopupManager.sol";
import "./ICaskKeeperTopup.sol";
import "./KeeperRegistryBaseInterface.sol";
import "./LinkTokenInterface.sol";
import "./IPegSwap.sol";


contract CaskKeeperTopupManager is
Initializable,
ReentrancyGuardUpgradeable,
CaskJobQueue,
ICaskKeeperTopupManager
{
    using SafeERC20 for IERC20Metadata;

    uint8 private constant QUEUE_ID_KEEPER_TOPUP = 1;


    /** @dev Pointer to CaskKeeperTopup contract */
    ICaskKeeperTopup public caskKeeperTopup;

    /** @dev vault to use for KeeperTopup funding. */
    ICaskVault public caskVault;

    KeeperRegistryBaseInterface public keeperRegistry;
    IERC20Metadata public linkBridgeToken;
    LinkTokenInterface public link677Token;
    AggregatorV3Interface public linkPriceFeed;
    address[] public linkSwapPath;
    IUniswapV2Router02 public linkSwapRouter;
    IPegSwap public pegswap;


    /************************** PARAMETERS **************************/

    /** @dev max number of failed KeeperTopup purchases before KeeperTopup is permanently canceled. */
    uint256 public maxSkips;

    /** @dev KeeperTopup transaction fee. */
    uint256 public topupFeeBps;
    uint256 public topupFeeMin;

    uint256 public maxPriceFeedAge;

    uint256 public maxTopupsPerRun;


    function initialize(
        address _caskKeeperTopup,
        address _caskVault,
        address _keeperRegistry,
        address _linkBridgeToken,
        address _link677Token,
        address _linkPriceFeed,
        address _linkSwapRouter,
        address[] calldata _linkSwapPath,
        address _pegswap
    ) public initializer {
        caskKeeperTopup = ICaskKeeperTopup(_caskKeeperTopup);
        caskVault = ICaskVault(_caskVault);

        keeperRegistry = KeeperRegistryBaseInterface(_keeperRegistry);
        linkBridgeToken = IERC20Metadata(_linkBridgeToken);
        link677Token = LinkTokenInterface(_link677Token);
        linkPriceFeed = AggregatorV3Interface(_linkPriceFeed);
        linkSwapRouter = IUniswapV2Router02(_linkSwapRouter);
        linkSwapPath = _linkSwapPath;
        pegswap = IPegSwap(_pegswap);

        maxSkips = 0;
        topupFeeBps = 0;
        topupFeeMin = 0;
        maxPriceFeedAge = 0;
        maxTopupsPerRun = 1;

        __CaskJobQueue_init(12 hours);
    }
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function registerKeeperTopupGroup(
        uint256 _keeperTopupGroupId
    ) override external nonReentrant whenNotPaused {
        processWorkUnit(QUEUE_ID_KEEPER_TOPUP, bytes32(_keeperTopupGroupId));
    }

    function processWorkUnit(
        uint8 _queueId,
        bytes32 _keeperTopupGroupId
    ) override internal {

        ICaskKeeperTopup.KeeperTopupGroup memory keeperTopupGroup =
            caskKeeperTopup.getKeeperTopupGroup(uint256(_keeperTopupGroupId));

        uint256 count = 0;

        for (uint256 i = 0; i < keeperTopupGroup.keeperTopups.length || count < maxTopupsPerRun; i++) {
            if (_processKeeperTopup(keeperTopupGroup.keeperTopups[i])) {
                count += 1;
            }
        }

        if (count >= maxTopupsPerRun) { // possibly more topups to process in this group - schedule immediate recheck
            scheduleWorkUnit(_queueId, _keeperTopupGroupId, bucketAt(currentBucket()));
        } else {

            // everything in this group has been processed - move group to next check period
            if (keeperTopupGroup.count > 0) { // stop processing empty groups
                scheduleWorkUnit(_queueId, _keeperTopupGroupId, bucketAt(keeperTopupGroup.processAt + queueBucketSize));
            }
        }
    }

    function _processKeeperTopup(
        bytes32 _keeperTopupId
    ) internal returns(bool) {

        ICaskKeeperTopup.KeeperTopup memory keeperTopup = caskKeeperTopup.getKeeperTopup(_keeperTopupId);

        if (keeperTopup.status != ICaskKeeperTopup.KeeperTopupStatus.Active){
            return false;
        }

        uint96 balance;
        uint64 maxValidBlocknumber;
        (,,, balance,,,maxValidBlocknumber) = keeperRegistry.getUpkeep(keeperTopup.keeperId);

        // upkeep not active
        if (maxValidBlocknumber != type(uint64).max) {
            caskKeeperTopup.managerCommand(_keeperTopupId, ICaskKeeperTopup.ManagerCommand.Cancel);
            return false;
        }

        // keeper balance is ok - check again next period
        if (balance > keeperTopup.lowBalance) {
            return false;
        }

        // did a topup happen successfully?
        if (_performKeeperTopup(_keeperTopupId)) {
            caskKeeperTopup.managerProcessed(_keeperTopupId);
        } else {
            if (maxSkips > 0 && keeperTopup.numSkips >= maxSkips) {
                caskKeeperTopup.managerCommand(_keeperTopupId, ICaskKeeperTopup.ManagerCommand.Pause);
            } else {
                caskKeeperTopup.managerCommand(_keeperTopupId, ICaskKeeperTopup.ManagerCommand.Skip);
            }
        }

        return true;
    }

    function _performKeeperTopup(
        bytes32 _keeperTopupId
    ) internal returns(bool) {

        ICaskKeeperTopup.KeeperTopup memory keeperTopup = caskKeeperTopup.getKeeperTopup(_keeperTopupId);

        uint256 beforeBalance = IERC20Metadata(address(caskVault.getBaseAsset())).balanceOf(address(this));

        uint256 topupFee = (keeperTopup.topupAmount * topupFeeBps) / 10000;
        if (topupFee < topupFeeMin) {
            topupFee = topupFeeMin;
        }

        // perform a 'payment' to this contract, fee goes to vault
        try caskVault.protocolPayment(keeperTopup.user, address(this), keeperTopup.topupAmount, topupFee) {
            // noop
        } catch (bytes memory) {
            caskKeeperTopup.managerSkipped(_keeperTopupId, ICaskKeeperTopup.SkipReason.PaymentFailed);
            return false;
        }

        // then withdraw the MASH received above as input asset to fund swap
        uint256 withdrawShares = caskVault.sharesForValue(keeperTopup.topupAmount - topupFee);
        if (withdrawShares > caskVault.balanceOf(address(this))) {
            withdrawShares = caskVault.balanceOf(address(this));
        }
        try caskVault.withdraw(caskVault.getBaseAsset(), withdrawShares) {
            // noop
        } catch (bytes memory) {
            caskKeeperTopup.managerSkipped(_keeperTopupId, ICaskKeeperTopup.SkipReason.PaymentFailed);
            return false;
        }

        // calculate actual amount of inputAsset that was received from payment/withdraw
        uint256 amountIn = IERC20Metadata(caskVault.getBaseAsset()).balanceOf(address(this)) - beforeBalance;
        require(amountIn > 0, "!INVALID(amountIn)");

        // let swap router spend the amount of newly acquired inputAsset
        IERC20Metadata(caskVault.getBaseAsset()).safeIncreaseAllowance(address(linkSwapRouter), amountIn);

        // TODO: convert amountIn to linkToken price (minus some slippage)
        uint256 amountOutEst = 0;

        // perform swap
        try linkSwapRouter.swapExactTokensForTokens(
            amountIn,
            amountOutEst, // adjust for slippage
            linkSwapPath,
            address(this),
            block.timestamp + 1 hours
        ) returns (uint256[] memory amounts) {
            require(amounts.length >= 2, "!INVALID(amounts)");
        } catch (bytes memory) {
            caskKeeperTopup.managerSkipped(_keeperTopupId, ICaskKeeperTopup.SkipReason.SwapFailed);
            return false;
        }

        if (address(pegswap) != address(0)) {
            uint256 amountBridgeOut = linkBridgeToken.balanceOf(address(this));

            try pegswap.swap(amountBridgeOut, address(linkBridgeToken), address(link677Token)) {
                // noop
            } catch (bytes memory) {
                caskKeeperTopup.managerSkipped(_keeperTopupId, ICaskKeeperTopup.SkipReason.SwapFailed);
                return false;
            }
        }

        uint256 amount677Out = link677Token.balanceOf(address(this));

        try link677Token.transferAndCall(address(keeperRegistry), amount677Out, abi.encode(keeperTopup.keeperId)) {
            // noop
        } catch (bytes memory) {
            caskKeeperTopup.managerSkipped(_keeperTopupId, ICaskKeeperTopup.SkipReason.KeeperFundingFailure);
            return false;
        }

        return true;
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
            // oracles are already in same precision, so just scale _amount to asset precision,
            // and multiply by the price feed ratio
            return _scalePrice(_amount, _fromAsset.assetDecimals, toAssetDecimals) * fromOraclePrice / toOraclePrice;
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
        uint256 _topupFeeBps,
        uint256 _topupFeeMin,
        uint256 _maxPriceFeedAge,
        uint256 _maxTopupsPerRun,
        uint32 _queueBucketSize,
        uint32 _maxQueueAge
    ) external onlyOwner {
        maxSkips = _maxSkips;
        topupFeeBps = _topupFeeBps;
        topupFeeMin = _topupFeeMin;
        maxPriceFeedAge = _maxPriceFeedAge;
        maxTopupsPerRun = _maxTopupsPerRun;
        queueBucketSize = _queueBucketSize;
        maxQueueAge = _maxQueueAge;
    }

    function setChainklinkAddresses(
        address _keeperRegistry,
        address _linkBridgeToken,
        address _link677Token,
        address _linkPriceFeed,
        address _linkSwapRouter,
        address[] calldata _linkSwapPath,
        address _pegswap
    ) external onlyOwner {
        keeperRegistry = KeeperRegistryBaseInterface(_keeperRegistry);
        linkBridgeToken = IERC20Metadata(_linkBridgeToken);
        link677Token = LinkTokenInterface(_link677Token);
        linkPriceFeed = AggregatorV3Interface(_linkPriceFeed);
        linkSwapRouter = IUniswapV2Router02(_linkSwapRouter);
        linkSwapPath = _linkSwapPath;
        pegswap = IPegSwap(_pegswap);
    }

}