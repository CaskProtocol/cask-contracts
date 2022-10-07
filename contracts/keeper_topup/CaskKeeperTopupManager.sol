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
import "./VRFCoordinatorV2Interface.sol";
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

    IERC20Metadata public linkBridgeToken;
    LinkTokenInterface public linkFundingToken;
    AggregatorV3Interface public linkPriceFeed;
    address[] public linkSwapPath;
    IUniswapV2Router02 public linkSwapRouter;
    IPegSwap public pegswap;


    /************************** PARAMETERS **************************/

    /** @dev max number of failed KeeperTopup purchases before KeeperTopup is permanently canceled. */
    uint256 public maxSkips;

    /** @dev KeeperTopup transaction fee bps and min. */
    uint256 public topupFeeBps;
    uint256 public topupFeeMin;

    /** @dev max allowable age for price feed data. */
    uint256 public maxPriceFeedAge;

    /** @dev max number of topups to do per each run of a group. */
    uint256 public maxTopupsPerGroupRun;

    /** @dev max slippage allowed when buying LINK on the DEX for a topup. */
    uint256 public maxSwapSlippageBps;

    /** @dev Address to receive DCA fees. */
    address public feeDistributor;


    function initialize(
        address _caskKeeperTopup,
        address _caskVault,
        address _linkBridgeToken,
        address _linkFundingToken,
        address _linkPriceFeed,
        address _linkSwapRouter,
        address[] calldata _linkSwapPath,
        address _pegswap,
        address _feeDistributor
    ) public initializer {
        caskKeeperTopup = ICaskKeeperTopup(_caskKeeperTopup);
        caskVault = ICaskVault(_caskVault);

        linkBridgeToken = IERC20Metadata(_linkBridgeToken);
        linkFundingToken = LinkTokenInterface(_linkFundingToken);
        linkPriceFeed = AggregatorV3Interface(_linkPriceFeed);
        linkSwapRouter = IUniswapV2Router02(_linkSwapRouter);
        linkSwapPath = _linkSwapPath;
        pegswap = IPegSwap(_pegswap);
        feeDistributor = _feeDistributor;

        maxSkips = 0;
        topupFeeBps = 0;
        topupFeeMin = 0;
        maxPriceFeedAge = 0;
        maxTopupsPerGroupRun = 1;
        maxSwapSlippageBps = 100;

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

        uint32 timestamp = uint32(block.timestamp);

        // not time to process yet, re-queue for processAt time
        if (keeperTopupGroup.processAt > timestamp) {
            scheduleWorkUnit(_queueId, _keeperTopupGroupId, bucketAt(keeperTopupGroup.processAt));
            return;
        }

        uint256 count = 0;

        for (uint256 i = 0; i < keeperTopupGroup.keeperTopups.length && count < maxTopupsPerGroupRun; i++) {
            if (_processKeeperTopup(keeperTopupGroup.keeperTopups[i])) {
                count += 1;
            }
        }

        if (count >= keeperTopupGroup.keeperTopups.length || count < maxTopupsPerGroupRun) {
            // everything in this group has been processed - move group to next check period
            if (keeperTopupGroup.count > 0) { // stop processing empty groups
                scheduleWorkUnit(_queueId, _keeperTopupGroupId, bucketAt(keeperTopupGroup.processAt + queueBucketSize));
                caskKeeperTopup.managerProcessedGroup(uint256(_keeperTopupGroupId),
                    keeperTopupGroup.processAt + queueBucketSize);
            }
        } else {
            // still more to do - schedule an immediate re-run
            scheduleWorkUnit(_queueId, _keeperTopupGroupId, bucketAt(currentBucket()));
        }

    }

    function _processKeeperTopup(
        bytes32 _keeperTopupId
    ) internal returns(bool) {
        ICaskKeeperTopup.KeeperTopup memory keeperTopup = caskKeeperTopup.getKeeperTopup(_keeperTopupId);

        if (keeperTopup.status != ICaskKeeperTopup.KeeperTopupStatus.Active){
            return false;
        }

        // topup target not active
        if (!_topupValid(_keeperTopupId)) {
            caskKeeperTopup.managerCommand(_keeperTopupId, ICaskKeeperTopup.ManagerCommand.Cancel);
            return false;
        }

        // balance is ok - check again next period
        if (_topupBalance(_keeperTopupId) >= keeperTopup.lowBalance) {
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

        // perform a 'payment' to this contract, fee is taken out manually after a successful swap
        try caskVault.protocolPayment(keeperTopup.user, address(this), keeperTopup.topupAmount, 0) {
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
        caskVault.withdraw(caskVault.getBaseAsset(), withdrawShares);

        // calculate actual amount of baseAsset that was received from payment/withdraw
        uint256 amountIn = IERC20Metadata(caskVault.getBaseAsset()).balanceOf(address(this)) - beforeBalance;
        require(amountIn > 0, "!INVALID(amountIn)");

        // let swap router spend the amount of newly acquired baseAsset
        IERC20Metadata(caskVault.getBaseAsset()).safeIncreaseAllowance(address(linkSwapRouter), amountIn);

        uint256 amountOutMin = 0;

        // if there is a pricefeed calc max slippage
        if (address(linkPriceFeed) != address(0)) {
            amountOutMin = _convertPrice(
                caskVault.getAsset(caskVault.getBaseAsset()),
                linkSwapPath[linkSwapPath.length - 1],
                address(linkPriceFeed),
                amountIn);
            amountOutMin = amountOutMin - ((amountOutMin * maxSwapSlippageBps) / 10000);
        }

        uint256 amountFundingTokenBefore = linkFundingToken.balanceOf(address(this));

        // perform swap
        try linkSwapRouter.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            linkSwapPath,
            address(this),
            block.timestamp + 1 hours
        ) returns (uint256[] memory amounts) {
            require(amounts.length >= 2, "!INVALID(amounts)");

            // any non-withdrawn shares are the fee portion - send to fee distributor
            caskVault.transfer(feeDistributor, caskVault.balanceOf(address(this)));

        } catch (bytes memory) {

            // undo withdraw and send shares back to user
            IERC20Metadata(caskVault.getBaseAsset()).safeIncreaseAllowance(address(caskVault), amountIn);
            caskVault.deposit(caskVault.getBaseAsset(), amountIn);
            caskVault.transfer(keeperTopup.user, caskVault.balanceOf(address(this))); // refund full amount

            caskKeeperTopup.managerSkipped(_keeperTopupId, ICaskKeeperTopup.SkipReason.SwapFailed);
            return false;
        }

        if (address(pegswap) != address(0)) {
            uint256 amountBridgeOut = linkBridgeToken.balanceOf(address(this));
            IERC20Metadata(address(linkBridgeToken)).safeIncreaseAllowance(address(pegswap), amountBridgeOut);
            pegswap.swap(amountBridgeOut, address(linkBridgeToken), address(linkFundingToken));
        }

        uint256 amountFundingTokenOut = linkFundingToken.balanceOf(address(this)) - amountFundingTokenBefore;

        _doTopup(_keeperTopupId, amountFundingTokenOut);

        return true;
    }

    function _topupBalance(
        bytes32 _keeperTopupId
    ) internal view returns(uint256) {
        ICaskKeeperTopup.KeeperTopup memory keeperTopup = caskKeeperTopup.getKeeperTopup(_keeperTopupId);

        uint96 balance = type(uint96).max;

        if (keeperTopup.topupType == ICaskKeeperTopup.TopupType.Automation) {
            KeeperRegistryBaseInterface keeperRegistry = KeeperRegistryBaseInterface(keeperTopup.registry);
            (,,,balance,,,) = keeperRegistry.getUpkeep(keeperTopup.targetId);

        } else if (keeperTopup.topupType == ICaskKeeperTopup.TopupType.VRF) {
            VRFCoordinatorV2Interface coordinator = VRFCoordinatorV2Interface(keeperTopup.registry);
            (balance,,,) = coordinator.getSubscription(uint64(keeperTopup.targetId));
        }

        return uint256(balance);
    }

    function _topupValid(
        bytes32 _keeperTopupId
    ) internal view returns(bool) {
        ICaskKeeperTopup.KeeperTopup memory keeperTopup = caskKeeperTopup.getKeeperTopup(_keeperTopupId);

        if (keeperTopup.topupType == ICaskKeeperTopup.TopupType.Automation) {
            KeeperRegistryBaseInterface keeperRegistry = KeeperRegistryBaseInterface(keeperTopup.registry);
            uint64 maxValidBlocknumber;
            (,,,,,,maxValidBlocknumber) = keeperRegistry.getUpkeep(keeperTopup.targetId);
            return maxValidBlocknumber == type(uint64).max;

        } else if (keeperTopup.topupType == ICaskKeeperTopup.TopupType.VRF) {
            VRFCoordinatorV2Interface coordinator = VRFCoordinatorV2Interface(keeperTopup.registry);
            address owner;
            (,,owner,) = coordinator.getSubscription(uint64(keeperTopup.targetId));
            return owner != address(0);
        }

        return false;
    }

    function _doTopup(
        bytes32 _keeperTopupId,
        uint256 _amount
    ) internal {
        ICaskKeeperTopup.KeeperTopup memory keeperTopup = caskKeeperTopup.getKeeperTopup(_keeperTopupId);

        if (keeperTopup.topupType == ICaskKeeperTopup.TopupType.Automation) {
            // we dont use the ERC677 interface here because arbitrum LINK is not ERC677
            KeeperRegistryBaseInterface keeperRegistry = KeeperRegistryBaseInterface(keeperTopup.registry);
            IERC20Metadata(address(linkFundingToken)).safeIncreaseAllowance(keeperTopup.registry, _amount);
            keeperRegistry.addFunds(keeperTopup.targetId, uint96(_amount));

        } else if (keeperTopup.topupType == ICaskKeeperTopup.TopupType.VRF) {
            VRFCoordinatorV2Interface coordinator = VRFCoordinatorV2Interface(keeperTopup.registry);
            linkFundingToken.transferAndCall(keeperTopup.registry, _amount, abi.encode(uint64(keeperTopup.targetId)));
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
        uint256 _maxTopupsPerGroupRun,
        uint256 _maxSwapSlippageBps,
        uint32 _queueBucketSize,
        uint32 _maxQueueAge
    ) external onlyOwner {
        maxSkips = _maxSkips;
        topupFeeBps = _topupFeeBps;
        topupFeeMin = _topupFeeMin;
        maxPriceFeedAge = _maxPriceFeedAge;
        maxTopupsPerGroupRun = _maxTopupsPerGroupRun;
        maxSwapSlippageBps = _maxSwapSlippageBps;
        queueBucketSize = _queueBucketSize;
        maxQueueAge = _maxQueueAge;
    }

    function setChainklinkAddresses(
        address _linkBridgeToken,
        address _linkFundingToken,
        address _linkPriceFeed,
        address _linkSwapRouter,
        address[] calldata _linkSwapPath,
        address _pegswap
    ) external onlyOwner {
        linkBridgeToken = IERC20Metadata(_linkBridgeToken);
        linkFundingToken = LinkTokenInterface(_linkFundingToken);
        linkPriceFeed = AggregatorV3Interface(_linkPriceFeed);
        linkSwapRouter = IUniswapV2Router02(_linkSwapRouter);
        linkSwapPath = _linkSwapPath;
        pegswap = IPegSwap(_pegswap);
    }

    function setFeeDistributor(
        address _feeDistributor
    ) external onlyOwner {
        feeDistributor = _feeDistributor;
        emit SetFeeDistributor(_feeDistributor);
    }

}
