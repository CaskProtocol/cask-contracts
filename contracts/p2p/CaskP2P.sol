// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@opengsn/contracts/src/BaseRelayRecipient.sol";

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";

import "../interfaces/ICaskP2P.sol";
import "../interfaces/ICaskP2PManager.sol";
import "../interfaces/INFTRenderer.sol";

contract CaskP2P is
ICaskP2P,
Initializable,
OwnableUpgradeable,
PausableUpgradeable,
BaseRelayRecipient,
IERC721Metadata
{
    using SafeERC20 for IERC20Metadata;

    /** @dev contract to manage P2P executions. */
    ICaskP2PManager public p2pManager;

    /** @dev map of P2P ID to P2P info. */
    mapping(bytes32 => P2P) private p2pMap; // p2pId => P2P
    mapping(address => bytes32[]) private userP2Ps; // user => p2pId[]


    /** @dev minimum amount of vault base asset for a P2P. */
    uint256 public minAmount;

    /** @dev minimum period for a P2P. */
    uint32 public minPeriod;

    /** @dev address of NFT renderer */
    address public nftRenderer;

    /** @dev mapping of user active token count */
    mapping(address => uint256) private userBalances; // user => balance

    /** for reentrancy guard impl */
    uint256 private constant _RG_NOT_ENTERED = 1;
    uint256 private constant _RG_ENTERED = 2;
    uint256 private _rg_status;


    function initialize() public initializer {
        __Ownable_init();
        __Pausable_init();

        minAmount = 1;
        minPeriod = 86400;
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

    modifier onlyUser(bytes32 _p2pId) {
        require(_msgSender() == p2pMap[_p2pId].user, "!AUTH");
        _;
    }

    modifier onlyManager() {
        require(_msgSender() == address(p2pManager), "!AUTH");
        _;
    }


    function createP2P(
        address _to,
        uint256 _amount,
        uint256 _totalAmount,
        uint32 _period
    ) external override nonReentrant whenNotPaused returns(bytes32) {
        require(_amount >= minAmount, "!INVALID(amount)");
        require(_period >= minPeriod, "!INVALID(period)");

        bytes32 p2pId = keccak256(abi.encodePacked(_msgSender(), _amount, _period, block.number, block.timestamp));

        uint32 timestamp = uint32(block.timestamp);

        P2P storage p2p = p2pMap[p2pId];
        p2p.user = _msgSender();
        p2p.to = _to;
        p2p.amount = _amount;
        p2p.totalAmount = _totalAmount;
        p2p.period = _period;
        p2p.createdAt = timestamp;
        p2p.processAt = timestamp;
        p2p.status = P2PStatus.Active;

        userP2Ps[_msgSender()].push(p2pId);

        p2pManager.registerP2P(p2pId);

        require(p2p.status == P2PStatus.Active, "!UNPROCESSABLE");
        require(p2p.numPayments == 1, "!UNPROCESSABLE"); // make sure first P2P payment succeeded

        emit P2PCreated(p2pId, p2p.user, p2p.to, _amount, _totalAmount, _period);

        userBalances[p2p.user] += 1;
        emit Transfer(address(0), p2p.user, uint256(p2pId));

        return p2pId;
    }

    function pauseP2P(
        bytes32 _p2pId
    ) external override onlyUser(_p2pId) whenNotPaused {
        P2P storage p2p = p2pMap[_p2pId];
        require(p2p.status == P2PStatus.Active, "!NOT_ACTIVE");

        p2p.status = P2PStatus.Paused;

        emit P2PPaused(_p2pId, p2p.user);
    }

    function resumeP2P(
        bytes32 _p2pId
    ) external override onlyUser(_p2pId) whenNotPaused {
        P2P storage p2p = p2pMap[_p2pId];
        require(p2p.status == P2PStatus.Paused, "!NOT_PAUSED");

        p2p.status = P2PStatus.Active;

        if (p2p.processAt < uint32(block.timestamp)) {
            p2p.processAt = uint32(block.timestamp);
        }

        p2pManager.registerP2P(_p2pId);

        emit P2PResumed(_p2pId, p2p.user);
    }

    function cancelP2P(
        bytes32 _p2pId
    ) external override onlyUser(_p2pId) whenNotPaused {
        P2P storage p2p = p2pMap[_p2pId];
        require(p2p.status == P2PStatus.Active ||
            p2p.status == P2PStatus.Paused, "!INVALID(status)");

        p2p.status = P2PStatus.Canceled;

        emit P2PCanceled(_p2pId, p2p.user);

        userBalances[p2p.user] -= 1;
        emit Transfer(p2p.user, address(0), uint256(_p2pId));
    }

    function getP2P(
        bytes32 _p2pId
    ) external override view returns (P2P memory) {
        return p2pMap[_p2pId];
    }

    function getUserP2P(
        address _user,
        uint256 _idx
    ) external override view returns (bytes32) {
        return userP2Ps[_user][_idx];
    }

    function getUserP2PCount(
        address _user
    ) external override view returns (uint256) {
        return userP2Ps[_user].length;
    }


    /************************** MANAGER FUNCTIONS **************************/

    function managerCommand(
        bytes32 _p2pId,
        ManagerCommand _command
    ) external override onlyManager {

        P2P storage p2p = p2pMap[_p2pId];

        if (_command == ManagerCommand.Skip) {

            p2p.processAt = p2p.processAt + p2p.period;
            p2p.numSkips += 1;

            emit P2PSkipped(_p2pId, p2p.user);

        } else if (_command == ManagerCommand.Pause) {

            p2p.status = P2PStatus.Paused;

            emit P2PPaused(_p2pId, p2p.user);

        } else if (_command == ManagerCommand.Cancel) {

            p2p.status = P2PStatus.Canceled;

            emit P2PCanceled(_p2pId, p2p.user);

            userBalances[p2p.user] -= 1;
            emit Transfer(p2p.user, address(0), uint256(_p2pId));
        }
    }

    function managerProcessed(
        bytes32 _p2pId,
        uint256 _amount,
        uint256 _fee
    ) external override onlyManager {
        P2P storage p2p = p2pMap[_p2pId];

        p2p.processAt = p2p.processAt + p2p.period;
        p2p.currentAmount += _amount;
        p2p.numPayments += 1;
        p2p.currentFees += _fee;

        emit P2PProcessed(_p2pId, p2p.user, _amount, _fee);

        if (p2p.totalAmount > 0 && p2p.currentAmount >= p2p.totalAmount) {
            p2p.status = P2PStatus.Complete;
            emit P2PCompleted(_p2pId, p2p.user);

            userBalances[p2p.user] -= 1;
            emit Transfer(p2p.user, address(0), uint256(_p2pId));
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
        address _p2pManager
    ) external onlyOwner {
        p2pManager = ICaskP2PManager(_p2pManager);
    }

    function setTrustedForwarder(
        address _forwarder
    ) external onlyOwner {
        _setTrustedForwarder(_forwarder);
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
        require(p2pMap[bytes32(tokenId)].user != address(0), "ERC721: owner query for nonexistent token");
        require(p2pMap[bytes32(tokenId)].status == ICaskP2P.P2PStatus.Active ||
                p2pMap[bytes32(tokenId)].status == ICaskP2P.P2PStatus.Paused, "ERC721: owner query for nonexistent token");
        return p2pMap[bytes32(tokenId)].user;
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
    function tokenURI(uint256 _p2pId) public view override returns (string memory) {
        require(p2pMap[bytes32(_p2pId)].user != address(0), "URI query for nonexistent token");
        if (nftRenderer == address(0)) {
            return "";
        }
        return INFTRenderer(nftRenderer).tokenURI(address(this), _p2pId);
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