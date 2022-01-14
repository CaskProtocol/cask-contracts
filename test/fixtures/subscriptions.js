const {
    loadFixture,
    usdcUnits,
    daiUnits,
    usdtUnits,
    day,
    month,
    isFork
} = require("../_helpers");

const {
    vaultFixture
} = require("./vault");

const addresses = require("../../utils/addresses");

async function protocolFixture() {
    const fixture = await loadFixture(vaultFixture);

    const signers = await ethers.getSigners();

    fixture.consumerA = signers[4];
    fixture.consumerB = signers[5];
    fixture.consumerC = signers[6];
    fixture.providerA = signers[7];
    fixture.providerB = signers[8];
    fixture.providerC = signers[9];


    if (isFork) {
        fixture.usdt = await ethers.getContractAt("IERC20", addresses.polygon.USDT);
        fixture.dai = await ethers.getContractAt("IERC20", addresses.polygon.DAI);
        fixture.usdc = await ethers.getContractAt("IERC20", addresses.polygon.USDC);
        fixture.weth = await ethers.getContractAt("IERC20", addresses.polygon.WETH);
    } else {
        fixture.usdt = await ethers.getContract("MockUSDT");
        fixture.dai = await ethers.getContract("MockDAI");
        fixture.usdc = await ethers.getContract("MockUSDC");
        fixture.weth = await ethers.getContract("MockWETH");
    }

    fixture.vaultAdmin = await ethers.getContract("CaskVaultAdmin");
    fixture.vault = await ethers.getContract("CaskVault");
    fixture.subscriptionPlans = await ethers.getContract("CaskSubscriptionPlans");
    fixture.subscriptions = await ethers.getContract("CaskSubscriptions");

    return fixture;
}

async function basicFixture() {
    const fixture = await loadFixture(protocolFixture);

    await fixture.subscriptionPlans.connect(fixture.providerA).createSubscriptionPlan(
        ethers.utils.formatBytes32String("plan1"), // planCode
        day * 7, // period - 7 days
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