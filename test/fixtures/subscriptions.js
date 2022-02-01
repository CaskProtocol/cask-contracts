const {
    daiUnits,
    day,
    month,
} = require("../../utils/units");

const {
    encodePlanData,
    plansMerkleRoot,
    discountsMerkleRoot,
    signMerkleRoots,
    encodeDiscountData,
    generateDiscountId,
} = require("../../utils/plans");

const {
    fundedFixture,
} = require("./vault");

async function protocolFixture() {
    const fixture = await fundedFixture();

    fixture.vaultAdmin = await ethers.getContract("CaskVaultAdmin");
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
        planData: encodePlanData(
            100, // planId
            daiUnits('10'), // price
            month, // period
            7 * day, // freeTrial
            0, // maxActive
            0, // minPeriods
            true, // canPause
            true) // canTransfer
    });

    fixture.plansRoot = plansMerkleRoot(fixture.plans);
    fixture.discountsRoot = discountsMerkleRoot(fixture.discounts);
    fixture.signedRoots = await signMerkleRoots(fixture.providerA, fixture.plansRoot, fixture.discountsRoot);

    return fixture;
}

async function twoPlanFixture() {
    const fixture = await protocolFixture();

    fixture.plans.push({
        provider: fixture.providerA.address,
        planId: 200,
        planData: encodePlanData(
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
        planData: encodePlanData(
            201, // planId
            daiUnits('20'), // price
            month, // period
            7 * day, // freeTrial
            0, // maxActive
            0, // minPeriods
            true, // canPause
            true) // canTransfer
    });

    fixture.plansRoot = plansMerkleRoot(fixture.plans);
    fixture.discountsRoot = discountsMerkleRoot(fixture.discounts);
    fixture.signedRoots = await signMerkleRoots(fixture.providerA, fixture.plansRoot, fixture.discountsRoot);

    return fixture;
}

async function unpausablePlanFixture() {
    const fixture = await protocolFixture();

    fixture.plans.push({
        provider: fixture.providerA.address,
        planId: 301,
        planData: encodePlanData(
            301, // planId
            daiUnits('10'), // price
            month, // period
            7 * day, // freeTrial
            0, // maxActive
            0, // minPeriods
            false, // canPause
            true) // canTransfer
    });

    fixture.plansRoot = plansMerkleRoot(fixture.plans);
    fixture.discountsRoot = discountsMerkleRoot(fixture.discounts);
    fixture.signedRoots = await signMerkleRoots(fixture.providerA, fixture.plansRoot, fixture.discountsRoot);

    return fixture;
}

async function minTermPlanFixture() {
    const fixture = await protocolFixture();

    fixture.plans.push({
        provider: fixture.providerA.address,
        planId: 401,
        planData: encodePlanData(
            401, // planId
            daiUnits('10'), // price
            month, // period
            7 * day, // freeTrial
            0, // maxActive
            12, // minPeriods
            true, // canPause
            true) // canTransfer
    });

    fixture.plansRoot = plansMerkleRoot(fixture.plans);
    fixture.discountsRoot = discountsMerkleRoot(fixture.discounts);
    fixture.signedRoots = await signMerkleRoots(fixture.providerA, fixture.plansRoot, fixture.discountsRoot);

    return fixture;
}

async function onePlanWithDiscountsFixture() {
    const fixture = await protocolFixture();

    fixture.plans.push({
        provider: fixture.providerA.address,
        planId: 501,
        planData: encodePlanData(
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
        discountId: generateDiscountId('discount1'),
        discountData: encodeDiscountData(
            5000, // value
            0,  // validAfter
            0, // expiresAt
            0, // maxUses
            501, // planId
            false) // isFixed
    });

    fixture.discounts.push({
        discountId: generateDiscountId('discount2'),
        discountData: encodeDiscountData(
            1000, // value
            0,  // validAfter
            0, // expiresAt
            0, // maxUses
            501, // planId
            false) // isFixed
    });


    fixture.plansRoot = plansMerkleRoot(fixture.plans);
    fixture.discountsRoot = discountsMerkleRoot(fixture.discounts);
    fixture.signedRoots = await signMerkleRoots(fixture.providerA, fixture.plansRoot, fixture.discountsRoot);

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