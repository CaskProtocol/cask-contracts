const {
    usdcUnits,
    linkUnits,
} = require("../../utils/units");

const {
    fundedFixture,
} = require("./vault");


async function cltuFixture() {
    const fixture = await fundedFixture();

    fixture.user = fixture.consumerA;
    fixture.keeperRegistry = await ethers.getContract("MockKeeperRegistry");
    fixture.cltu = await ethers.getContract("CaskChainlinkTopup");
    fixture.cltuManager = await ethers.getContract("CaskChainlinkTopupManager");
    fixture.router = await ethers.getContract("MockUniswapRouterUSDCLINK");
    fixture.priceFeed = await ethers.getContract("MockChainlinkOracleFeedLINK");
    fixture.pegSwap = await ethers.getContract("MockPegSwap");
    fixture.usdc = await ethers.getContract("MockUSDC");
    fixture.erc20Link = await ethers.getContract("MockERC20LINK");
    fixture.erc677Link = await ethers.getContract("MockERC677LINK");

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
}