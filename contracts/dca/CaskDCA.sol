// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@opengsn/contracts/src/BaseRelayRecipient.sol";

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";

import "../interfaces/ICaskDCA.sol";
import "../interfaces/ICaskDCAManager.sol";
import "../interfaces/INFTRenderer.sol";

contract CaskDCA is
ICaskDCA,
Initializable,
OwnableUpgradeable,
PausableUpgradeable,
BaseRelayRecipient,
IERC721Metadata
{
    using SafeERC20 for IERC20Metadata;

    /** @dev contract to manage DCA executions. */
    ICaskDCAManager public dcaManager;

    /** @dev map of DCA ID to DCA info. */
    mapping(bytes32 => DCA) private dcaMap; // dcaId => DCA
    mapping(address => bytes32[]) private userDCAs; // user => dcaId[]


    /** @dev merkle root of approved assets. */
    bytes32 public assetsMerkleRoot;

    /** @dev minimum amount of vault base asset for a DCA. */
    uint256 public minAmount;

    /** @dev minimum period for a DCA. */
    uint32 public minPeriod;

    /** @dev minimum slippage allowed for a DCA. */
    uint256 public minSlippage;

    /** @dev swap type and optional swap data for a DCA. */
    mapping(bytes32 => SwapInfo) private swapInfoMap; // dcaId => DCASwapInfo

    /** @dev previous merkle root of approved assets. */
    bytes32 public prevAssetsMerkleRoot;

    /** @dev address allowed to update asset merkle root. */
    address public assetsAdmin;

    /** @dev address of NFT renderer */
    address public nftRenderer;

    /** @dev mapping of user active token count */
    mapping(address => uint256) private userBalances; // user => balance

    /** for reentrancy guard impl */
    uint256 private constant _RG_NOT_ENTERED = 1;
    uint256 private constant _RG_ENTERED = 2;
    uint256 private _rg_status;


    modifier onlyAssetsAdmin() {
        require(_msgSender() == address(assetsAdmin), "!AUTH");
        _;
    }

    function initialize(
        bytes32 _assetsMerkleRoot
    ) public initializer {
        __Ownable_init();
        __Pausable_init();

        assetsMerkleRoot = _assetsMerkleRoot;
        prevAssetsMerkleRoot = assetsMerkleRoot;
        minAmount = 1;
        minPeriod = 86400;
        minSlippage = 10;
        assetsAdmin = _msgSender();
    }
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function versionRecipient() public pure override returns(string memory) { return "2.2.0"; }

    function _msgSender() internal view override(ContextUpgradeable, BaseRelayRecipient)
    returns (address sender) {
        sender = BaseRelayRecipient._msgSender();
    }

    function _msgData() internal view override(ContextUpgradeable, BaseRelayRecipient)
    returns (bytes calldata) {
        return BaseRelayRecipient._msgData();
    }

    modifier onlyUser(bytes32 _dcaId) {
        require(_msgSender() == dcaMap[_dcaId].user, "!AUTH");
        _;
    }

    modifier onlyManager() {
        require(_msgSender() == address(dcaManager), "!AUTH");
        _;
    }


    function createDCA(
        address[] calldata _assetSpec, // router, priceFeed, path...
        bytes32[] calldata _merkleProof,
        SwapProtocol _swapProtocol,
        bytes calldata _swapData,
        address _to,
        uint256[] calldata _priceSpec // period, amount, totalAmount, maxSlippageBps, minPrice, maxPrice
    ) external override nonReentrant whenNotPaused returns(bytes32) {
        require(_assetSpec.length >= 4, "!INVALID(assetSpec)");
        require(_priceSpec.length == 6, "!INVALID(priceSpec)");
        require(_priceSpec[0] >= minPeriod, "!INVALID(period)");
        require(_priceSpec[1] >= minAmount, "!INVALID(amount)");
        require(_priceSpec[3] >= minSlippage, "!INVALID(maxSlippageBps)");
        require(_verifyAssetSpec(_swapProtocol, _swapData, _assetSpec, _merkleProof), "!INVALID(assetSpec)");

        bytes32 dcaId = keccak256(abi.encodePacked(_msgSender(), _swapProtocol, _swapData, _assetSpec, _priceSpec,
            block.number, block.timestamp));

        DCA storage dca = dcaMap[dcaId];
        dca.user = _msgSender();
        dca.to = _to;
        dca.router = _assetSpec[0];
        dca.priceFeed = _assetSpec[1];
        dca.path = _assetSpec[2:];
        dca.amount = _priceSpec[1];
        dca.totalAmount = _priceSpec[2];
        dca.period = uint32(_priceSpec[0]);
        dca.minPrice = _priceSpec[4];
        dca.maxPrice = _priceSpec[5];
        dca.maxSlippageBps = _priceSpec[3];
        dca.createdAt = uint32(block.timestamp);
        dca.processAt = uint32(block.timestamp);
        dca.status = DCAStatus.Active;

        SwapInfo storage swapData = swapInfoMap[dcaId];
        swapData.swapProtocol = _swapProtocol;
        swapData.swapData = _swapData;

        userDCAs[_msgSender()].push(dcaId);

        dcaManager.registerDCA(dcaId);

        require(dca.status == DCAStatus.Active, "!UNPROCESSABLE");
        require(dca.numBuys == 1, "!UNPROCESSABLE"); // make sure first DCA purchase succeeded

        emit DCACreated(dcaId, dca.user, dca.to, dca.path[0], dca.path[dca.path.length-1],
            dca.amount, dca.totalAmount, dca.period);

        userBalances[dca.user] += 1;
        emit Transfer(address(0), dca.user, uint256(dcaId));

        return dcaId;
    }

    function pauseDCA(
        bytes32 _dcaId
    ) external override onlyUser(_dcaId) whenNotPaused {
        DCA storage dca = dcaMap[_dcaId];
        require(dca.status == DCAStatus.Active, "!NOT_ACTIVE");

        dca.status = DCAStatus.Paused;

        emit DCAPaused(_dcaId, dca.user);
    }

    function resumeDCA(
        bytes32 _dcaId
    ) external override onlyUser(_dcaId) whenNotPaused {
        DCA storage dca = dcaMap[_dcaId];
        require(dca.status == DCAStatus.Paused, "!NOT_PAUSED");

        dca.status = DCAStatus.Active;

        if (dca.processAt < uint32(block.timestamp)) {
            dca.processAt = uint32(block.timestamp);
        }

        dcaManager.registerDCA(_dcaId);

        emit DCAResumed(_dcaId, dca.user);
    }

    function cancelDCA(
        bytes32 _dcaId
    ) external override onlyUser(_dcaId) whenNotPaused {
        DCA storage dca = dcaMap[_dcaId];
        require(dca.status == DCAStatus.Active ||
                dca.status == DCAStatus.Paused, "!INVALID(status)");

        dca.status = DCAStatus.Canceled;

        emit DCACanceled(_dcaId, dca.user);

        userBalances[dca.user] -= 1;
        emit Transfer(dca.user, address(0), uint256(_dcaId));
    }

    function _verifyAssetSpec(
        SwapProtocol _swapProtocol,
        bytes calldata _swapData,
        address[] calldata _assetSpec,
        bytes32[] calldata _merkleProof
    ) internal view returns(bool) {
        bytes32 assetSpecHash =
            keccak256(abi.encode(_swapProtocol, _swapData, _assetSpec[0], _assetSpec[1], _assetSpec[2:]));

        return MerkleProof.verify(_merkleProof, assetsMerkleRoot, assetSpecHash) ||
            MerkleProof.verify(_merkleProof, prevAssetsMerkleRoot, assetSpecHash);
    }


    function getDCA(
        bytes32 _dcaId
    ) external override view returns (DCA memory) {
        return dcaMap[_dcaId];
    }

    function getSwapInfo(
        bytes32 _dcaId
    ) external override view returns (SwapInfo memory) {
        return swapInfoMap[_dcaId];
    }

    function getUserDCA(
        address _user,
        uint256 _idx
    ) external override view returns (bytes32) {
        return userDCAs[_user][_idx];
    }

    function getUserDCACount(
        address _user
    ) external override view returns (uint256) {
        return userDCAs[_user].length;
    }


    /************************** MANAGER FUNCTIONS **************************/

    function managerCommand(
        bytes32 _dcaId,
        ManagerCommand _command
    ) external override onlyManager {

        DCA storage dca = dcaMap[_dcaId];

        if (_command == ManagerCommand.Pause) {

            dca.status = DCAStatus.Paused;

            emit DCAPaused(_dcaId, dca.user);

        } else if (_command == ManagerCommand.Cancel) {

            dca.status = DCAStatus.Canceled;

            emit DCACanceled(_dcaId, dca.user);

            userBalances[dca.user] -= 1;
            emit Transfer(dca.user, address(0), uint256(_dcaId));
        }
    }

    function managerSkipped(
        bytes32 _dcaId,
        SkipReason _skipReason
    ) external override onlyManager {
        DCA storage dca = dcaMap[_dcaId];

        dca.processAt = dca.processAt + dca.period;
        dca.numSkips += 1;

        emit DCASkipped(_dcaId, dca.user, _skipReason);
    }

    function managerProcessed(
        bytes32 _dcaId,
        uint256 _amount,
        uint256 _buyQty,
        uint256 _fee
    ) external override onlyManager {
        DCA storage dca = dcaMap[_dcaId];

        dca.processAt = dca.processAt + dca.period;
        dca.currentAmount += _amount;
        dca.currentQty += _buyQty;
        dca.numBuys += 1;
        dca.currentFees += _fee;

        emit DCAProcessed(_dcaId, dca.user, _amount, _buyQty, _fee);

        if (dca.totalAmount > 0 && dca.currentAmount >= dca.totalAmount) {
            dca.status = DCAStatus.Complete;
            emit DCACompleted(_dcaId, dca.user);

            userBalances[dca.user] -= 1;
            emit Transfer(dca.user, address(0), uint256(_dcaId));
        }

    }

    /************************** ADMIN FUNCTIONS **************************/

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setManager(
        address _dcaManager
    ) external onlyOwner {
        dcaManager = ICaskDCAManager(_dcaManager);
    }

    function setTrustedForwarder(
        address _forwarder
    ) external onlyOwner {
        _setTrustedForwarder(_forwarder);
    }

    function setAssetsAdmin(
        address _assetsAdmin
    ) external onlyOwner {
        assetsAdmin = _assetsAdmin;
        emit AssetAdminChange(assetsAdmin);
    }

    function setAssetsMerkleRoot(
        bytes32 _assetsMerkleRoot
    ) external onlyAssetsAdmin {
        prevAssetsMerkleRoot = assetsMerkleRoot;
        assetsMerkleRoot = _assetsMerkleRoot;
        emit AssetsMerkleRootChanged(prevAssetsMerkleRoot, assetsMerkleRoot);
    }

    function setMinAmount(
        uint256 _minAmount
    ) external onlyOwner {
        minAmount = _minAmount;
    }

    function setMinPeriod(
        uint32 _minPeriod
    ) external onlyOwner {
        minPeriod = _minPeriod;
    }

    function setMinSlippage(
        uint256 _minSlippage
    ) external onlyOwner {
        minSlippage = _minSlippage;
    }

    function setNFTRenderer(
        address _nftRenderer
    ) external onlyOwner {
        nftRenderer = _nftRenderer;
    }


    /******* ReentrancyGuard *********/

    function __ReentrancyGuard_init() internal onlyInitializing {
        __ReentrancyGuard_init_unchained();
    }

    function __ReentrancyGuard_init_unchained() internal onlyInitializing {
        _rg_status = _RG_NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        // On the first call to nonReentrant, _notEntered will be true
        require(_rg_status != _RG_ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _rg_status = _RG_ENTERED;

        _;

        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _rg_status = _RG_NOT_ENTERED;
    }


    /******* ERC721 *********/

    /**
      * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return
        interfaceId == type(IERC721).interfaceId ||
        interfaceId == type(IERC721Metadata).interfaceId;
    }

    /**
     * @dev See {IERC721-balanceOf}.
     */
    function balanceOf(address owner) public view override returns (uint256) {
        require(owner != address(0), "ERC721: balance query for the zero address");
        return userBalances[owner];
    }

    /**
     * @dev See {IERC721-ownerOf}.
     */
    function ownerOf(uint256 tokenId) public view override returns (address) {
        require(dcaMap[bytes32(tokenId)].user != address(0), "ERC721: owner query for nonexistent token");
        require(dcaMap[bytes32(tokenId)].status == ICaskDCA.DCAStatus.Active ||
                dcaMap[bytes32(tokenId)].status == ICaskDCA.DCAStatus.Paused, "ERC721: owner query for nonexistent token");
        return dcaMap[bytes32(tokenId)].user;
    }

    /**
     * @dev See {IERC721Metadata-name}.
     */
    function name() public view override returns (string memory) {
        return "Cask DCA";
    }

    /**
     * @dev See {IERC721Metadata-symbol}.
     */
    function symbol() public view override returns (string memory) {
        return "CASKDCA";
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 _dcaId) public view override returns (string memory) {
        require(dcaMap[bytes32(_dcaId)].user != address(0), "URI query for nonexistent token");
        if (nftRenderer == address(0)) {
            return "";
        }
        return INFTRenderer(nftRenderer).tokenURI(address(this), _dcaId);
    }

    /**
     * @dev See {IERC721-approve}.
     */
    function approve(address to, uint256 tokenId) public override {
        revert("!NON_TRANSFERRABLE");
    }

    /**
     * @dev See {IERC721-getApproved}.
     */
    function getApproved(uint256 tokenId) public view override returns (address) {
        revert("!NON_TRANSFERRABLE");
    }

    /**
     * @dev See {IERC721-setApprovalForAll}.
     */
    function setApprovalForAll(address operator, bool approved) public override {
        revert("!NON_TRANSFERRABLE");
    }

    /**
     * @dev See {IERC721-isApprovedForAll}.
     */
    function isApprovedForAll(address owner, address operator) public view override returns (bool) {
        revert("!NON_TRANSFERRABLE");
    }

    /**
     * @dev See {IERC721-transferFrom}.
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        revert("!NON_TRANSFERRABLE");
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        revert("!NON_TRANSFERRABLE");
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) public override {
        revert("!NON_TRANSFERRABLE");
    }

}