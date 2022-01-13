const {
    loadFixture,
    usdcUnits,
    daiUnits,
    usdtUnits,
    isFork
} = require("../_helpers");

const addresses = require("../../utils/addresses");

async function protocolFixture() {
    await deployments.fixture(); // ensure you start from a fresh deployments

    // accounts
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const governor = signers[1];
    const strategist = signers[2];
    const consumerA = signers[4];
    const consumerB = signers[5];
    const consumerC = signers[6];
    const providerA = signers[7];
    const providerB = signers[8];
    const providerC = signers[9];


    // assets
    let usdt,
        dai,
        usdc,
        weth;

    if (isFork) {
        usdt = await ethers.getContractAt("IERC20", addresses.polygon.USDT);
        dai = await ethers.getContractAt("IERC20", addresses.polygon.DAI);
        usdc = await ethers.getContractAt("IERC20", addresses.polygon.USDC);
        weth = await ethers.getContractAt("IERC20", addresses.polygon.WETH);
    } else {
        usdt = await ethers.getContract("MockUSDT");
        dai = await ethers.getContract("MockDAI");
        usdc = await ethers.getContract("MockUSDC");
        weth = await ethers.getContract("MockWETH");
    }

    // contracts
    const vaultAdmin = await ethers.getContract("CaskVaultAdmin");
    const vault = await ethers.getContract("CaskVault");
    const subscriptionPlans = await ethers.getContract("CaskSubscriptionPlans");
    const subscriptions = await ethers.getContract("CaskSubscriptions");


    return {
        //accounts
        deployer,
        governor,
        strategist,
        consumerA,
        consumerB,
        consumerC,
        providerA,
        providerB,
        providerC,
        // assets
        usdt,
        dai,
        usdc,
        weth,
        //contracts
        vaultAdmin,
        vault,
        subscriptionPlans,
        subscriptions,
    };
}

async function basicFixture() {
    const fixture = await loadFixture(protocolFixture);

    await fixture.subscriptionPlans.connect(fixture.providerA).createSubscriptionPlan(
        ethers.utils.formatBytes32String("plan1"), // planCode
        86400 * 7, // period - 7 days
        daiUnits('10.0'), // price - in baseAsset
        0, // minTerm
        3, // freeTrialDays
        true, // canPause
        fixture.providerA.address, // paymentAddress
        ethers.utils.keccak256("0x"), 0, 0 // metaHash, metaHF, metaSize - IPFS CID of plan metadata
    );

    fixture.subscriptionPlanIds = await fixture.subscriptionPlans.getSubscriptionPlans(fixture.providerA.address);

    return fixture;
}

async function basicFundedFixture() {
    const fixture = await loadFixture(basicFixture);

    for (const consumer of [fixture.consumerA, fixture.consumerB, fixture.consumerC]) {
        await fixture.usdt.connect(consumer).mint(usdtUnits('1000.0'));
        await fixture.usdt.connect(consumer).approve(fixture.vault.address, usdtUnits('1000.0'));

        await fixture.dai.connect(consumer).mint(daiUnits('1000.0'));
        await fixture.dai.connect(consumer).approve(fixture.vault.address, daiUnits('1000.0'));

        await fixture.usdc.connect(consumer).mint(usdcUnits('1000.0'));
        await fixture.usdc.connect(consumer).approve(fixture.vault.address, usdcUnits('1000.0'));
    }

    return fixture;
}

module.exports = {
    protocolFixture,
    basicFixture,
    basicFundedFixture,
}