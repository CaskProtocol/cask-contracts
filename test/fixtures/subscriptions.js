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

async function singlePlanFixture() {
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

module.exports = {
    protocolFixture,
    singlePlanFixture,
}