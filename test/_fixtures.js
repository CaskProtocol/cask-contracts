
const {
    loadFixture,
    usdcUnits,
    daiUnits,
    usdtUnits, caskUnits
} = require("./_helpers");

const {isFork} = require("./_helpers.js");
const addresses = require("../utils/addresses");

async function defaultFixture() {
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
    const fixture = await loadFixture(defaultFixture);

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

async function vestingFixture() {
    await deployments.fixture(); // ensure you start from a fresh deployments

    // accounts
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const governor = signers[1];
    const alice = signers[11];
    const bob = signers[12];
    const charlie = signers[13];

    // contracts
    const caskToken = await ethers.getContract("CaskToken");
    const teamVestedEscrow = await ethers.getContract("TeamVestedEscrow");
    const investorVestedEscrow = await ethers.getContract("InvestorVestedEscrow");

    return {
        //accounts
        deployer,
        governor,
        alice,
        bob,
        charlie,
        caskToken,
        teamVestedEscrow,
        investorVestedEscrow,
    };
}

async function investorVestingFixture() {
    const fixture = await loadFixture(vestingFixture);

    fixture.vestingStart = Math.floor(Date.now() / 1000);

    await fixture.investorVestedEscrow.connect(fixture.governor)['fund(uint256,address[],uint256[])'](
        fixture.vestingStart,
        [
            fixture.alice.address,
            fixture.bob.address
        ],
        [
            caskUnits('48000000'), // 1M per month over 3 years
            caskUnits('96000000') // 2M per month over 3 years
        ]
    );

    return fixture;
}

async function teamVestingFixture() {
    const fixture = await loadFixture(vestingFixture);

    fixture.vestingStart = Math.floor(Date.now() / 1000);
    fixture.cliffDuration = 86400 * 365; // 1 year

    await fixture.teamVestedEscrow.connect(fixture.governor)['fund(uint256,uint256,address[],uint256[])'](
        fixture.vestingStart,
        fixture.cliffDuration,
        [
            fixture.alice.address,
            fixture.bob.address,
            fixture.charlie.address
        ],
        [
            caskUnits('48000000'), // 1M per month over 4 years
            caskUnits('96000000'), // 2M per month over 4 years
            caskUnits('48000000') // 1M per month over 4 years
        ]
    );

    return fixture;
}

module.exports = {
    defaultFixture,
    basicFixture,
    basicFundedFixture,
    vestingFixture,
    teamVestingFixture,
    investorVestingFixture,
}