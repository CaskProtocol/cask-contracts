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
import "./ICaskChainlinkTopupManager.sol";
import "./ICaskChainlinkTopup.sol";
import "./AutomationRegistryBaseInterface.sol";
import "./VRFCoordinatorV2Interface.sol";
import "./LinkTokenInterface.sol";
import "./IPegSwap.sol";


contract CaskChainlinkTopupManager is
Initializable,
ReentrancyGuardUpgradeable,
CaskJobQueue,
ICaskChainlinkTopupManager
{
    using SafeERC20 for IERC20Metadata;

    uint8 private constant QUEUE_ID_KEEPER_TOPUP = 1;


    /** @dev map of registries address that are allowed */
    mapping(address => bool) public allowedRegistries;

    /** @dev Pointer to CaskChainlinkTopup contract */
    ICaskChainlinkTopup public caskChainlinkTopup;

    /** @dev vault to use for ChainlinkTopup funding. */
    ICaskVault public caskVault;

    IERC20Metadata public linkBridgeToken;
    LinkTokenInterface public linkFundingToken;
    AggregatorV3Interface public linkPriceFeed;
    address[] public linkSwapPath;
    IUniswapV2Router02 public linkSwapRouter;
    IPegSwap public pegswap;


    /************************** PARAMETERS **************************/

    /** @dev max number of failed ChainlinkTopup purchases before ChainlinkTopup is permanently canceled. */
    uint256 public maxSkips;

    /** @dev ChainlinkTopup transaction fee bps and min. */
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
        address _caskChainlinkTopup,
        address _caskVault,
        address _linkBridgeToken,
        address _linkFundingToken,
        address _linkPriceFeed,
        address _linkSwapRouter,
        address[] calldata _linkSwapPath,
        address _pegswap,
        address _feeDistributor
    ) public initializer {
        caskChainlinkTopup = ICaskChainlinkTopup(_caskChainlinkTopup);
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

    function registerChainlinkTopup(
        bytes32 _chainlinkTopupId
    ) override external nonReentrant whenNotPaused {

        ICaskChainlinkTopup.ChainlinkTopup memory chainlinkTopup =
            caskChainlinkTopup.getChainlinkTopup(_chainlinkTopupId);
        require(chainlinkTopup.groupId > 0, "!INVALID(groupId)");

        _processChainlinkTopup(_chainlinkTopupId);

        ICaskChainlinkTopup.ChainlinkTopupGroup memory chainlinkTopupGroup =
            caskChainlinkTopup.getChainlinkTopupGroup(chainlinkTopup.groupId);

        if (chainlinkTopupGroup.chainlinkTopups.length == 1) { // register only if new/reinitialized group
            scheduleWorkUnit(QUEUE_ID_KEEPER_TOPUP, bytes32(chainlinkTopup.groupId), uint32(block.timestamp));
        }
    }

    function processWorkUnit(
        uint8 _queueId,
        bytes32 _chainlinkTopupGroupId
    ) override internal {

        ICaskChainlinkTopup.ChainlinkTopupGroup memory chainlinkTopupGroup =
            caskChainlinkTopup.getChainlinkTopupGroup(uint256(_chainlinkTopupGroupId));

        // empty group - stop processing
        if (chainlinkTopupGroup.chainlinkTopups.length == 0) {
            return;
        }

        uint256 count = 0;

        for (uint256 i = 0; i < chainlinkTopupGroup.chainlinkTopups.length && count < maxTopupsPerGroupRun; i++) {
            if (_processChainlinkTopup(chainlinkTopupGroup.chainlinkTopups[i])) {
                count += 1;
            }
        }

        if (count >= chainlinkTopupGroup.chainlinkTopups.length || count < maxTopupsPerGroupRun) {
            scheduleWorkUnit(_queueId, _chainlinkTopupGroupId, uint32(block.timestamp));
        } else {
            // still more to do - schedule an immediate re-run
            requeueWorkUnit(_queueId, _chainlinkTopupGroupId);
        }

    }

    function registryAllowed(
        address _registry
    ) override external view returns(bool) {
        return allowedRegistries[_registry];
    }

    function _processChainlinkTopup(
        bytes32 _chainlinkTopupId
    ) internal returns(bool) {
        ICaskChainlinkTopup.ChainlinkTopup memory chainlinkTopup =
            caskChainlinkTopup.getChainlinkTopup(_chainlinkTopupId);

        if (chainlinkTopup.status != ICaskChainlinkTopup.ChainlinkTopupStatus.Active){
            return false;
        }

        if (chainlinkTopup.retryAfter >= uint32(block.timestamp)) {
            return false;
        }

        // topup target not active
        if (!_topupValid(_chainlinkTopupId) || !allowedRegistries[chainlinkTopup.registry]) {
            caskChainlinkTopup.managerCommand(_chainlinkTopupId, ICaskChainlinkTopup.ManagerCommand.Cancel);
            return false;
        }

        // balance is ok - check again next period
        if (_topupBalance(_chainlinkTopupId) >= chainlinkTopup.lowBalance) {
            return false;
        }

        uint256 topupFee = (chainlinkTopup.topupAmount * topupFeeBps) / 10000;
        if (topupFee < topupFeeMin) {
            topupFee = topupFeeMin;
        }

        uint256 buyQty = _performChainlinkTopup(_chainlinkTopupId, topupFee);

        // did a topup happen successfully?
        if (buyQty > 0) {
            caskChainlinkTopup.managerProcessed(_chainlinkTopupId, chainlinkTopup.topupAmount, buyQty, topupFee);
        } else {
            if (maxSkips > 0 && chainlinkTopup.numSkips >= maxSkips) {
                caskChainlinkTopup.managerCommand(_chainlinkTopupId, ICaskChainlinkTopup.ManagerCommand.Pause);
            }
        }

        return true;
    }

    function _performChainlinkTopup(
        bytes32 _chainlinkTopupId,
        uint256 _protocolFee
    ) internal returns(uint256) {
        ICaskChainlinkTopup.ChainlinkTopup memory chainlinkTopup =
            caskChainlinkTopup.getChainlinkTopup(_chainlinkTopupId);

        uint256 beforeBalance = IERC20Metadata(address(caskVault.getBaseAsset())).balanceOf(address(this));

        // perform a 'payment' to this contract, fee is taken out manually after a successful swap
        try caskVault.protocolPayment(chainlinkTopup.user, address(this), chainlinkTopup.topupAmount, 0) {
            // noop
        } catch (bytes memory) {
            caskChainlinkTopup.managerSkipped(
                _chainlinkTopupId,
                uint32(block.timestamp) + queueBucketSize,
                ICaskChainlinkTopup.SkipReason.PaymentFailed
            );
            return 0;
        }

        // then withdraw the MASH received above as input asset to fund swap
        uint256 withdrawShares = caskVault.sharesForValue(chainlinkTopup.topupAmount - _protocolFee);
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
        linkSwapRouter.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            linkSwapPath,
            address(this),
            block.timestamp + 1 hours
        );

        // any non-withdrawn shares are the fee portion - send to fee distributor
        caskVault.transfer(feeDistributor, caskVault.balanceOf(address(this)));

        if (address(pegswap) != address(0)) {
            uint256 amountBridgeOut = linkBridgeToken.balanceOf(address(this));
            IERC20Metadata(address(linkBridgeToken)).safeIncreaseAllowance(address(pegswap), amountBridgeOut);
            pegswap.swap(amountBridgeOut, address(linkBridgeToken), address(linkFundingToken));
        }

        uint256 amountFundingTokenOut = linkFundingToken.balanceOf(address(this)) - amountFundingTokenBefore;

        _doTopup(_chainlinkTopupId, amountFundingTokenOut);

        return amountFundingTokenOut;
    }

    function _topupBalance(
        bytes32 _chainlinkTopupId
    ) internal view returns(uint256) {
        ICaskChainlinkTopup.ChainlinkTopup memory chainlinkTopup =
            caskChainlinkTopup.getChainlinkTopup(_chainlinkTopupId);

        uint96 balance = type(uint96).max;

        if (chainlinkTopup.topupType == ICaskChainlinkTopup.TopupType.Automation) {
            AutomationRegistryBaseInterface automationRegistry = AutomationRegistryBaseInterface(chainlinkTopup.registry);
            (,,,balance,,,) = automationRegistry.getUpkeep(chainlinkTopup.targetId);

        } else if (chainlinkTopup.topupType == ICaskChainlinkTopup.TopupType.VRF) {
            VRFCoordinatorV2Interface coordinator = VRFCoordinatorV2Interface(chainlinkTopup.registry);
            (balance,,,) = coordinator.getSubscription(uint64(chainlinkTopup.targetId));
        }

        return uint256(balance);
    }

    function _topupValid(
        bytes32 _chainlinkTopupId
    ) internal view returns(bool) {
        ICaskChainlinkTopup.ChainlinkTopup memory chainlinkTopup =
            caskChainlinkTopup.getChainlinkTopup(_chainlinkTopupId);

        if (chainlinkTopup.topupType == ICaskChainlinkTopup.TopupType.Automation) {
            AutomationRegistryBaseInterface automationRegistry = AutomationRegistryBaseInterface(chainlinkTopup.registry);
            try automationRegistry.getUpkeep(chainlinkTopup.targetId) returns (
                address target,
                uint32 executeGas,
                bytes memory checkData,
                uint96 balance,
                address lastKeeper,
                address admin,
                uint64 maxValidBlocknumber
            ) {
                return maxValidBlocknumber == type(uint64).max;
            } catch {
                return false;
            }

        } else if (chainlinkTopup.topupType == ICaskChainlinkTopup.TopupType.VRF) {
            VRFCoordinatorV2Interface coordinator = VRFCoordinatorV2Interface(chainlinkTopup.registry);
            try coordinator.getSubscription(uint64(chainlinkTopup.targetId)) returns (
                uint96 balance,
                uint64 reqCount,
                address owner,
                address[] memory consumers
            ) {
                return owner != address(0);
            } catch {
                return false;
            }
        }

        return false;
    }

    function _doTopup(
        bytes32 _chainlinkTopupId,
        uint256 _amount
    ) internal {
        ICaskChainlinkTopup.ChainlinkTopup memory chainlinkTopup =
            caskChainlinkTopup.getChainlinkTopup(_chainlinkTopupId);

        if (chainlinkTopup.topupType == ICaskChainlinkTopup.TopupType.Automation) {
            linkFundingToken.transferAndCall(chainlinkTopup.registry, _amount,
                abi.encode(chainlinkTopup.targetId));

        } else if (chainlinkTopup.topupType == ICaskChainlinkTopup.TopupType.VRF) {
            linkFundingToken.transferAndCall(chainlinkTopup.registry, _amount,
                abi.encode(uint64(chainlinkTopup.targetId)));
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

    function allowRegistry(
        address _registry
    ) external onlyOwner {
        allowedRegistries[_registry] = true;

        emit RegistryAllowed(_registry);
    }

    function disallowRegistry(
        address _registry
    ) external onlyOwner {
        allowedRegistries[_registry] = false;

        emit RegistryDisallowed(_registry);
    }

    function recoverFunds(
        address _asset,
        address _dest
    ) external onlyOwner {
        IERC20Metadata(_asset).transfer(_dest, IERC20Metadata(_asset).balanceOf(address(this)));
    }
}
