const { CaskSDK } = require('@caskprotocol/sdk');

const {
    usdcUnits,
    day,
    month,
} = require("../../utils/units");

const {
    fundedFixture,
} = require("./vault");


async function protocolFixture() {
    const fixture = await fundedFixture();

    fixture.vaultManager = await ethers.getContract("CaskVaultManager");
    fixture.vault = await ethers.getContract("CaskVault");
    fixture.subscriptionPlans = await ethers.getContract("CaskSubscriptionPlans");
    fixture.subscriptions = await ethers.getContract("CaskSubscriptions");
    fixture.subscriptionManager = await ethers.getContract("CaskSubscriptionManager");
    fixture.plans = [];
    fixture.discounts = [];

    return fixture;
}

async function onePlanFixture() {
    const fixture = await protocolFixture();

    fixture.plans.push({
        provider: fixture.providerA.address,
        planId: 100,
        planData: CaskSDK.utils.encodePlanData(
            100, // planId
            usdcUnits('10'), // price
            month, // period
            7 * day, // freeTrial
            0, // maxActive
            0, // minPeriods
            7, // gracePeriod
            true, // canPause
            true) // canTransfer
    });

    fixture.plansRoot = CaskSDK.utils.plansMerkleRoot(fixture.plans);
    fixture.discountsRoot = CaskSDK.utils.discountsMerkleRoot(fixture.discounts);
    fixture.signedRoots = await CaskSDK.utils.signMerkleRoots(fixture.providerA, 0, fixture.plansRoot,
        fixture.discountsRoot);

    return fixture;
}

async function twoPlanFixture() {
    const fixture = await protocolFixture();

    fixture.plans.push({
        provider: fixture.providerA.address,
        planId: 200,
        planData: CaskSDK.utils.encodePlanData(
            200, // planId
            usdcUnits('10'), // price
            month, // period
            7 * day, // freeTrial
            0, // maxActive
            0, // minPeriods
            7, // gracePeriod
            true, // canPause
            true) // canTransfer
    });

    fixture.plans.push({
        provider: fixture.providerA.address,
        planId: 201,
        planData: CaskSDK.utils.encodePlanData(
            201, // planId
            usdcUnits('20'), // price
            month, // period
            7 * day, // freeTrial
            0, // maxActive
            0, // minPeriods
            7, // gracePeriod
            true, // canPause
            true) // canTransfer
    });

    fixture.plansRoot = CaskSDK.utils.plansMerkleRoot(fixture.plans);
    fixture.discountsRoot = CaskSDK.utils.discountsMerkleRoot(fixture.discounts);
    fixture.signedRoots = await CaskSDK.utils.signMerkleRoots(fixture.providerA, 0, fixture.plansRoot,
        fixture.discountsRoot);

    return fixture;
}

async function unpausablePlanFixture() {
    const fixture = await protocolFixture();

    fixture.plans.push({
        provider: fixture.providerA.address,
        planId: 301,
        planData: CaskSDK.utils.encodePlanData(
            301, // planId
            usdcUnits('10'), // price
            month, // period
            7 * day, // freeTrial
            0, // maxActive
            0, // minPeriods
            7, // gracePeriod
            false, // canPause
            true) // canTransfer
    });

    fixture.plansRoot = CaskSDK.utils.plansMerkleRoot(fixture.plans);
    fixture.discountsRoot = CaskSDK.utils.discountsMerkleRoot(fixture.discounts);
    fixture.signedRoots = await CaskSDK.utils.signMerkleRoots(fixture.providerA, 0, fixture.plansRoot,
        fixture.discountsRoot);

    return fixture;
}

async function minTermPlanFixture() {
    const fixture = await protocolFixture();

    fixture.plans.push({
        provider: fixture.providerA.address,
        planId: 401,
        planData: CaskSDK.utils.encodePlanData(
            401, // planId
            usdcUnits('10'), // price
            month, // period
            7 * day, // freeTrial
            0, // maxActive
            12, // minPeriods
            7, // gracePeriod
            true, // canPause
            true) // canTransfer
    });

    fixture.plansRoot = CaskSDK.utils.plansMerkleRoot(fixture.plans);
    fixture.discountsRoot = CaskSDK.utils.discountsMerkleRoot(fixture.discounts);
    fixture.signedRoots = await CaskSDK.utils.signMerkleRoots(fixture.providerA, 0, fixture.plansRoot,
        fixture.discountsRoot);

    return fixture;
}

async function onePlanWithDiscountsFixture() {
    const fixture = await protocolFixture();

    fixture.plans.push({
        provider: fixture.providerA.address,
        planId: 501,
        planData: CaskSDK.utils.encodePlanData(
            501, // planId
            usdcUnits('10'), // price
            month, // period
            7 * day, // freeTrial
            0, // maxActive
            0, // minPeriods
            7, // gracePeriod
            false, // canPause
            true) // canTransfer
    });


    fixture.discounts.push({
        discountId: CaskSDK.utils.generateDiscountId('discount1'),
        discountData: CaskSDK.utils.encodeDiscountData(
            5000, // value
            0,  // validAfter
            0, // expiresAt
            0, // maxRedemptions
            501, // planId
            0, // applyPeriods
            1, // discountType (1=code)
            false) // isFixed
    });

    fixture.discounts.push({
        discountId: CaskSDK.utils.generateDiscountId('discount2'),
        discountData: CaskSDK.utils.encodeDiscountData(
            1000, // value
            0,  // validAfter
            0, // expiresAt
            0, // maxRedemptions
            501, // planId
            0, // applyPeriods
            1, // discountType (1=code)
            false) // isFixed
    });


    fixture.plansRoot = CaskSDK.utils.plansMerkleRoot(fixture.plans);
    fixture.discountsRoot = CaskSDK.utils.discountsMerkleRoot(fixture.discounts);
    fixture.signedRoots = await CaskSDK.utils.signMerkleRoots(fixture.providerA, 0, fixture.plansRoot,
        fixture.discountsRoot);

    return fixture;
}



module.exports = {
    protocolFixture,
    onePlanFixture,
    twoPlanFixture,
    unpausablePlanFixture,
    minTermPlanFixture,
    onePlanWithDiscountsFixture,
}