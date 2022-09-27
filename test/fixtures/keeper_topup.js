const {
    usdcUnits,
} = require("../../utils/units");

const {
    fundedFixture,
} = require("./vault");


async function dcaFixture() {
    const fixture = await fundedFixture();

    fixture.user = fixture.consumerA;
    fixture.ktu = await ethers.getContract("CaskKeeperTopup");
    fixture.ktuManager = await ethers.getContract("CaskKeeperTopupManager");
    fixture.router = await ethers.getContract("MockUniswapRouterUSDCLINK");
    fixture.priceFeed = await ethers.getContract("MockChainlinkOracleFeedLINK");
    fixture.pegSwap = await ethers.getContract("MockPegSwap");
    fixture.usdc = await ethers.getContract("MockUSDC");
    fixture.erc20Link = await ethers.getContract("MockERC20LINK");
    fixture.erc677Link = await ethers.getContract("MockERC677LINK");

    await fixture.router.connect(fixture.governor).initialize(
        [fixture.usdc.address, fixture.erc20Link.address],
        [fixture.usdc.address, fixture.erc677Link.address]
    );

    return fixture;
}

async function ktuFixture() {
    const fixture = await dcaFixture();

    await fixture.usdc.connect(fixture.deployer).mint(fixture.router.address, usdcUnits('200000.0'));
    await fixture.erc20Link.connect(fixture.deployer).mint(fixture.router.address,
        hre.ethers.utils.parseUnits('100000.0', 18));
    await fixture.erc677Link.connect(fixture.deployer).mint(fixture.router.address,
        hre.ethers.utils.parseUnits('100000.0', 18));

    return fixture;
}

module.exports = {
    ktuFixture,
}