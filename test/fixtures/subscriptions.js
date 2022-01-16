const {
    loadFixture,
    daiUnits,
    day,
    month,
} = require("../_helpers");

const {
    fundedFixture,
} = require("./vault");

async function protocolFixture() {
    const fixture = await loadFixture(fundedFixture);

    fixture.vaultAdmin = await ethers.getContract("CaskVaultAdmin");
    fixture.vault = await ethers.getContract("CaskVault");
    fixture.subscriptionPlans = await ethers.getContract("CaskSubscriptionPlans");
    fixture.subscriptions = await ethers.getContract("CaskSubscriptions");

    return fixture;
}

async function onePlanFixture() {
    const fixture = await loadFixture(protocolFixture);

    fixture.planCode = ethers.utils.formatBytes32String("plan1");

    const tx = await fixture.subscriptionPlans.connect(fixture.providerA).createPlan(
        fixture.planCode, // planCode
        month, // period
        daiUnits('10.0'), // price - in baseAsset
        0, // minTerm
        7 * day, // freeTrial
        true, // canPause
        fixture.providerA.address, // paymentAddress
        ethers.utils.keccak256("0x"), 0, 0 // metaHash, metaHF, metaSize - IPFS CID of plan metadata
    );

    const events = (await tx.wait()).events || [];
    const planCreatedEvent = events.find((e) => e.event === "PlanCreated");
    fixture.planId = planCreatedEvent.args.planId;

    return fixture;
}

async function twoPlanFixture() {
    const fixture = await loadFixture(protocolFixture);

    let tx, events, planCreatedEvent;

    fixture.planACode = ethers.utils.formatBytes32String("planA");
    tx = await fixture.subscriptionPlans.connect(fixture.providerA).createPlan(
        fixture.planACode, // planCode
        month, // period
        daiUnits('10.0'), // price - in baseAsset
        0, // minTerm
        7 * day, // freeTrial
        true, // canPause
        fixture.providerA.address, // paymentAddress
        ethers.utils.keccak256("0x"), 0, 0 // metaHash, metaHF, metaSize - IPFS CID of plan metadata
    );
    events = (await tx.wait()).events || [];
    planCreatedEvent = events.find((e) => e.event === "PlanCreated");
    fixture.planAId = planCreatedEvent.args.planId;

    fixture.planBCode = ethers.utils.formatBytes32String("planB");
    tx = await fixture.subscriptionPlans.connect(fixture.providerA).createPlan(
        fixture.planBCode, // planCode
        month, // period
        daiUnits('20.0'), // price - in baseAsset
        0, // minTerm
        7 * day, // freeTrial
        true, // canPause
        fixture.providerA.address, // paymentAddress
        ethers.utils.keccak256("0x"), 0, 0 // metaHash, metaHF, metaSize - IPFS CID of plan metadata
    );
    events = (await tx.wait()).events || [];
    planCreatedEvent = events.find((e) => e.event === "PlanCreated");
    fixture.planBId = planCreatedEvent.args.planId;

    return fixture;
}

async function unpausablePlanFixture() {
    const fixture = await loadFixture(protocolFixture);

    fixture.planCode = ethers.utils.formatBytes32String("plan1");

    const tx = await fixture.subscriptionPlans.connect(fixture.providerA).createPlan(
        fixture.planCode, // planCode
        month, // period
        daiUnits('10.0'), // price - in baseAsset
        0, // minTerm
        7 * day, // freeTrial
        false, // canPause
        fixture.providerA.address, // paymentAddress
        ethers.utils.keccak256("0x"), 0, 0 // metaHash, metaHF, metaSize - IPFS CID of plan metadata
    );

    const events = (await tx.wait()).events || [];
    const planCreatedEvent = events.find((e) => e.event === "PlanCreated");
    fixture.planId = planCreatedEvent.args.planId;

    return fixture;
}

async function minTermPlanFixture() {
    const fixture = await loadFixture(protocolFixture);

    fixture.planCode = ethers.utils.formatBytes32String("plan1");

    const tx = await fixture.subscriptionPlans.connect(fixture.providerA).createPlan(
        fixture.planCode, // planCode
        month, // period
        daiUnits('10.0'), // price - in baseAsset
        12 * month, // minTerm
        7 * day, // freeTrial
        true, // canPause
        fixture.providerA.address, // paymentAddress
        ethers.utils.keccak256("0x"), 0, 0 // metaHash, metaHF, metaSize - IPFS CID of plan metadata
    );

    const events = (await tx.wait()).events || [];
    const planCreatedEvent = events.find((e) => e.event === "PlanCreated");
    fixture.planId = planCreatedEvent.args.planId;

    return fixture;
}

module.exports = {
    protocolFixture,
    onePlanFixture,
    twoPlanFixture,
    unpausablePlanFixture,
    minTermPlanFixture,
}