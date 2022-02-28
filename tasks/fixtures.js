const {
    daiUnits,
    month,
    day
} = require("../utils/units");

const cask = require("@caskprotocol/sdk");

async function fixtures(taskArguments, hre) {

    console.log("Creating providers fixture data");

    const signers = await hre.ethers.getSigners();
    const deployer = signers[0];
    const consumerA = signers[4];
    const consumerB = signers[5];
    const consumerC = signers[6];
    const providerA = signers[7];
    const providerB = signers[8];
    const providerC = signers[9];

    const caskVault = await hre.ethers.getContract("CaskVault");
    const caskSubscriptionPlans = await hre.ethers.getContract("CaskSubscriptionPlans");
    const caskSubscriptions = await hre.ethers.getContract("CaskSubscriptions");

    // fund consumers and deposit to vault

    const dai = await ethers.getContract("MockDAI");
    await dai.connect(deployer).mint(consumerA.address, daiUnits('10000.0'));
    await dai.connect(consumerA).approve(caskVault.address, daiUnits('10000.0'));

    await caskVault.connect(consumerA).deposit(dai.address, daiUnits('100'));



    // fixture provider plans

    const plans = [];
    const discounts = [];

    plans.push(_createProviderPlan(providerA, 100, daiUnits('10'), month,
        7 * day, 0, 0, 7, true, true));

    plans.push(_createProviderPlan(providerA, 101, daiUnits('20'), month,
        7 * day, 0, 0, 7, true, true));

    discounts.push(_createProviderDiscount(providerA, 'CODE10', 1000, 0,
        0, 0, 0, 0, false));

    const plansRoot = cask.utils.plansMerkleRoot(plans);
    const discountsRoot = cask.utils.discountsMerkleRoot(discounts);

    const signedRoots = await cask.utils.signMerkleRoots(providerA, plansRoot, discountsRoot);
    console.log(`Generated signature for providerA configuration: ${signedRoots}`);

    // save provider profile to chain
    await caskSubscriptionPlans.connect(providerA).setProviderProfile(
        providerA.address,
        hre.ethers.utils.id("bogus_cid")
    );



    // create consumer A subscription to provider A plan 100

    const ref = ethers.utils.id("user1");

    const plan = plans.find((p) => p.planId === 100);
    const plansProof = cask.utils.generatePlanProof(plan.provider, ref, plan.planData, plansRoot,
        cask.utils.plansMerkleProof(plans, plan));
    const discountProof = cask.utils.generateDiscountProof(0, 0, discountsRoot)

    // create subscription
    const tx = await caskSubscriptions.connect(consumerA).createSubscription(
        plansProof, // planProof
        discountProof, // discountProof
        0, // cancelAt
        signedRoots, // providerSignature
        "" // cid
    );

    const events = (await tx.wait()).events || [];
    const createdEvent = events.find((e) => e.event === "SubscriptionCreated");
    const subscriptionId = createdEvent.args.subscriptionId;
    console.log(`Created subscriptionId ${subscriptionId} to plan ${plan.planId} for consumerA (${consumerA.address})`);

}

function _createProviderPlan(provider, planId, price, period, freeTrial, maxActive,
                                   minPeriods, gracePeriod, canPause, canTransfer)
{
    return {
        provider: provider.address,
        planId: planId,
        planData: cask.utils.encodePlanData(
            planId,
            price,
            period,
            freeTrial,
            maxActive,
            minPeriods,
            gracePeriod,
            canPause,
            canTransfer)
    }
}

function _createProviderDiscount(provider, discountCode, value, validAfter, expiresAt,
                                 maxUses, planId, applyPeriods, isFixed)
{
    return {
        provider: provider.address,
        discountId: cask.utils.generateDiscountId(discountCode),
        discountData: cask.utils.encodeDiscountData(
            value,
            validAfter,
            expiresAt,
            maxUses,
            planId,
            applyPeriods,
            isFixed)
    }
}

module.exports = {
    fixtures,
};
