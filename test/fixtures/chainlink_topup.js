const { deployments } = require("hardhat");

const {
    usdcUnits,
    linkUnits,
} = require("../../utils/units");

const {
    fundedFixture,
} = require("./vault");

const {
    getNetworkAddresses,
    getChainlinkAddresses,
    ChainlinkRegistryType
} = require("../_helpers");


async function cltuFixture() {
    const fixture = await fundedFixture();

    fixture.user = fixture.consumerA;
    fixture.vrfContract = fixture.providerA;
    fixture.automationRegistry = await ethers.getContract("MockAutomationRegistry");
    fixture.vrfCoordinator = await ethers.getContract("MockVRFCoordinator");
    fixture.cltu = await ethers.getContract("CaskChainlinkTopup");
    fixture.cltuManager = await ethers.getContract("CaskChainlinkTopupManager");
    fixture.router = await ethers.getContract("MockUniswapRouterUSDCLINK");
    fixture.priceFeed = await ethers.getContract("MockChainlinkOracleFeedLINK");
    fixture.pegSwap = await ethers.getContract("MockPegSwap");
    fixture.usdc = await ethers.getContract("MockUSDC");
    fixture.erc20Link = await ethers.getContract("MockERC20LINK");
    fixture.erc677Link = await ethers.getContract("MockERC677LINK");

    await fixture.cltuManager.connect(fixture.governor).allowRegistry(fixture.automationRegistry.address,
        ChainlinkRegistryType.AutomationV1_2);

    await fixture.cltuManager.connect(fixture.governor).allowRegistry(fixture.vrfCoordinator.address,
        ChainlinkRegistryType.VRF_V2);

    return fixture;
}

async function cltuFundedFixture() {
    const fixture = await cltuFixture();

    // mint swap liquidity to mock router
    await fixture.usdc.connect(fixture.deployer).mint(fixture.router.address, usdcUnits('100000.0'));
    await fixture.erc677Link.connect(fixture.deployer).mint(fixture.router.address, linkUnits('200000.0', 18));
    await fixture.erc20Link.connect(fixture.deployer).mint(fixture.router.address, linkUnits('200000.0', 18));

    // set 1 LINK to be 0.5 USDC
    await fixture.priceFeed.setPrice(ethers.utils.parseUnits('0.5', 8)); // set price feed to 0.5 USDC per LINK
    await fixture.router.setOutputBps(20000); // set LP output to give 2 LINK for every 1 USDC (ie, 0.5 price) to match price feed

    // user
    await fixture.erc677Link.connect(fixture.deployer).mint(fixture.user.address, linkUnits('1000.0'));

    return fixture;
}

async function cltuPegSwapFixture() {
    const fixture = await cltuFundedFixture();

    // mint pegswap liquidity
    await fixture.erc677Link.connect(fixture.deployer).mint(fixture.pegSwap.address, linkUnits('200000.0', 18));
    await fixture.erc20Link.connect(fixture.deployer).mint(fixture.pegSwap.address, linkUnits('200000.0', 18));

    const chainlinkAddresses = await getChainlinkAddresses(deployments);
    const networkAddresses = await getNetworkAddresses(deployments);

    await fixture.cltuManager.connect(fixture.governor).setChainklinkAddresses(
        chainlinkAddresses.ERC20LINK,
        chainlinkAddresses.ERC677LINK,
        chainlinkAddresses.LINK_USD,
        chainlinkAddresses.link_swap_router,
        [
            networkAddresses.USDC,
            chainlinkAddresses.ERC20LINK
        ],
        chainlinkAddresses.link_peg_swap,
        0,
        '0x'
    );

    return fixture;
}

async function cltuExcessSlippageFixture() {
    const fixture = await cltuFundedFixture();

    // set 1 LINK to be 0.5 USDC
    await fixture.priceFeed.setPrice(ethers.utils.parseUnits('0.5', 8));

    // output 1.9 LINK for every 1 USDC simulating 5% slippage from 0.5 price
    await fixture.router.setOutputBps(19000);

    return fixture;
}

module.exports = {
    cltuFixture,
    cltuFundedFixture,
    cltuExcessSlippageFixture,
    cltuPegSwapFixture,
}