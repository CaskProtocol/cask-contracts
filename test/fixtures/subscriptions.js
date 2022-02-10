const cask = require('@caskprotocol/sdk');

const {
    daiUnits,
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
        planData: cask.utils.encodePlanData(
            100, // planId
            daiUnits('10'), // price
            month, // period
            7 * day, // freeTrial
            0, // maxActive
            0, // minPeriods
            true, // canPause
            true) // canTransfer
    });

    fixture.plansRoot = cask.utils.plansMerkleRoot(fixture.plans);
    fixture.discountsRoot = cask.utils.discountsMerkleRoot(fixture.discounts);
    fixture.signedRoots = await cask.utils.signMerkleRoots(fixture.providerA, fixture.plansRoot,
        fixture.discountsRoot);

    return fixture;
}

async function twoPlanFixture() {
    const fixture = await protocolFixture();

    fixture.plans.push({
        provider: fixture.providerA.address,
        planId: 200,
        planData: cask.utils.encodePlanData(
            200, // planId
            daiUnits('10'), // price
            month, // period
            7 * day, // freeTrial
            0, // maxActive
            0, // minPeriods
            true, // canPause
            true) // canTransfer
    });

    fixture.plans.push({
        provider: fixture.providerA.address,
        planId: 201,
        planData: cask.utils.encodePlanData(
            201, // planId
            daiUnits('20'), // price
            month, // period
            7 * day, // freeTrial
            0, // maxActive
            0, // minPeriods
            true, // canPause
            true) // canTransfer
    });

    fixture.plansRoot = cask.utils.plansMerkleRoot(fixture.plans);
    fixture.discountsRoot = cask.utils.discountsMerkleRoot(fixture.discounts);
    fixture.signedRoots = await cask.utils.signMerkleRoots(fixture.providerA, fixture.plansRoot,
        fixture.discountsRoot);

    return fixture;
}

async function unpausablePlanFixture() {
    const fixture = await protocolFixture();

    fixture.plans.push({
        provider: fixture.providerA.address,
        planId: 301,
        planData: cask.utils.encodePlanData(
            301, // planId
            daiUnits('10'), // price
            month, // period
            7 * day, // freeTrial
            0, // maxActive
            0, // minPeriods
            false, // canPause
            true) // canTransfer
    });

    fixture.plansRoot = cask.utils.plansMerkleRoot(fixture.plans);
    fixture.discountsRoot = cask.utils.discountsMerkleRoot(fixture.discounts);
    fixture.signedRoots = await cask.utils.signMerkleRoots(fixture.providerA, fixture.plansRoot,
        fixture.discountsRoot);

    return fixture;
}

async function minTermPlanFixture() {
    const fixture = await protocolFixture();

    fixture.plans.push({
        provider: fixture.providerA.address,
        planId: 401,
        planData: cask.utils.encodePlanData(
            401, // planId
            daiUnits('10'), // price
            month, // period
            7 * day, // freeTrial
            0, // maxActive
            12, // minPeriods
            true, // canPause
            true) // canTransfer
    });

    fixture.plansRoot = cask.utils.plansMerkleRoot(fixture.plans);
    fixture.discountsRoot = cask.utils.discountsMerkleRoot(fixture.discounts);
    fixture.signedRoots = await cask.utils.signMerkleRoots(fixture.providerA, fixture.plansRoot,
        fixture.discountsRoot);

    return fixture;
}

async function onePlanWithDiscountsFixture() {
    const fixture = await protocolFixture();

    fixture.plans.push({
        provider: fixture.providerA.address,
        planId: 501,
        planData: cask.utils.encodePlanData(
            501, // planId
            daiUnits('10'), // price
            month, // period
            7 * day, // freeTrial
            0, // maxActive
            0, // minPeriods
            false, // canPause
            true) // canTransfer
    });


    fixture.discounts.push({
        discountId: cask.utils.generateDiscountId('discount1'),
        discountData: cask.utils.encodeDiscountData(
            5000, // value
            0,  // validAfter
            0, // expiresAt
            0, // maxUses
            501, // planId
            0, // applyPeriods
            false) // isFixed
    });

    fixture.discounts.push({
        discountId: cask.utils.generateDiscountId('discount2'),
        discountData: cask.utils.encodeDiscountData(
            1000, // value
            0,  // validAfter
            0, // expiresAt
            0, // maxUses
            501, // planId
            0, // applyPeriods
            false) // isFixed
    });


    fixture.plansRoot = cask.utils.plansMerkleRoot(fixture.plans);
    fixture.discountsRoot = cask.utils.discountsMerkleRoot(fixture.discounts);
    fixture.signedRoots = await cask.utils.signMerkleRoots(fixture.providerA, fixture.plansRoot,
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