const {
    usdcUnits,
    linkUnits,
} = require("../../utils/units");

const {
    fundedFixture,
} = require("./vault");


async function ktuFixture() {
    const fixture = await fundedFixture();

    fixture.user = fixture.consumerA;
    fixture.keeperRegistry = await ethers.getContract("MockKeeperRegistry");
    fixture.ktu = await ethers.getContract("CaskKeeperTopup");
    fixture.ktuManager = await ethers.getContract("CaskKeeperTopupManager");
    fixture.router = await ethers.getContract("MockUniswapRouterUSDCLINK");
    fixture.priceFeed = await ethers.getContract("MockChainlinkOracleFeedLINK");
    fixture.pegSwap = await ethers.getContract("MockPegSwap");
    fixture.usdc = await ethers.getContract("MockUSDC");
    fixture.erc20Link = await ethers.getContract("MockERC20LINK");
    fixture.erc677Link = await ethers.getContract("MockERC677LINK");

    // set 1 LINK to be 0.5 USDC
    await fixture.priceFeed.setPrice(ethers.utils.parseUnits('0.5', 8)); // set price feed to 0.5 USDC per LINK
    await fixture.router.setOutputBps(20000); // set LP output to give 2 LINK for every 1 USDC (ie, 0.5 price) to match price feed

    return fixture;
}

async function ktuFundedFixture() {
    const fixture = await ktuFixture();

    // user
    await fixture.erc677Link.connect(fixture.deployer).mint(fixture.user.address, linkUnits('10.0'));

    return fixture;
}

module.exports = {
    ktuFixture,
    ktuFundedFixture,
}