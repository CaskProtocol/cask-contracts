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

    // fund consumers and deposit to vault

    const dai = await ethers.getContract("MockDAI");
    await dai.connect(deployer).mint(consumerA.address, daiUnits('10000.0'));
    await dai.connect(consumerA).approve(caskVault.address, daiUnits('10000.0'));

    await caskVault.connect(consumerA).deposit(dai.address, daiUnits('25'));



    // fixture provider plans

    const plans = [];
    const discounts = [];

    plans.push(_createProviderPlan(100, daiUnits('10'), month,
        7 * day, 0, 0, 7, true, true));

    plans.push(_createProviderPlan(101, daiUnits('20'), day,
        0, 0, 0, 7, true, true));

    discounts.push(_createProviderDiscount('CODE10', 1000, 0,
        0, 0, 0, 0, false));

    const plansRoot = cask.utils.plansMerkleRoot(plans);
    const discountsRoot = cask.utils.discountsMerkleRoot(discounts);

    const signedRoots = await cask.utils.signMerkleRoots(providerA, plansRoot, discountsRoot);
    console.log(`Generated signature for providerA configuration: ${signedRoots}`);

    const profileData = {
        plans: cask.utils.plansMap(plans),
        discounts: cask.utils.discountsMap(discounts),
        planMerkleRoot: plansRoot,
        discountMerkleRoot: discountsRoot,
        signedRoots: signedRoots,
        metadata: {
            name: "Acme Services",
            iconUrl: "https://pbs.twimg.com/profile_images/652147288966479872/co4SZ_a2_400x400.jpg",
            websiteUrl: "https://www.example.com",
            supportUrl: "",
        }
    }

    let providerCid = "";
    if (process.env.PINATA_API_KEY) {
        const ipfs = new cask.ipfs.IPFS(process.env.PINATA_API_KEY, process.env.PINATA_API_SECRET);
        providerCid = await ipfs.save(profileData);
    }
    // save provider profile to chain
    await caskSubscriptionPlans.connect(providerA).setProviderProfile(providerA.address, providerCid);


    // subscription creations

    await createSubscription(consumerA, providerA, '12345', 100, profileData);

    await createSubscription(consumerA, providerA, '67890', 101, profileData);
}

async function createSubscription(consumer, provider, refString, planId, profileData) {
    const plans = Object.values(profileData.plans);
    const plan = plans.find((p) => p.planId === planId);
    if (!plan) {
        return;
    }

    const caskSubscriptions = await hre.ethers.getContract("CaskSubscriptions");

    const plansProof = cask.utils.generatePlanProof(
        provider.address,
        cask.utils.stringToRef(refString),
        plan.planData,
        profileData.planMerkleRoot,
        cask.utils.plansMerkleProof(plans, plan)
    );
    const discountProof = cask.utils.generateDiscountProof(
        0,
        0,
        profileData.discountMerkleRoot
    );

    let subscriptionCid = "";
    if (process.env.PINATA_API_KEY) {
        const ipfs = new cask.ipfs.IPFS(process.env.PINATA_API_KEY, process.env.PINATA_API_SECRET);
        subscriptionCid = await ipfs.save({
            consumer: consumer.address,
            ref: refString,
            planId: planId,
            image: profileData.metadata.iconUrl,
        });
    }

    // create subscription
    const tx = await caskSubscriptions.connect(consumer).createSubscription(
        plansProof, // planProof
        discountProof, // discountProof
        0, // cancelAt
        profileData.signedRoots, // providerSignature
        subscriptionCid // cid
    );

    const events = (await tx.wait()).events || [];
    const createdEvent = events.find((e) => e.event === "SubscriptionCreated");
    const subscriptionId = createdEvent.args.subscriptionId;
    console.log(`Created subscriptionId ${subscriptionId} to plan ${planId} for consumer (${consumer.address})`);
}


function _createProviderPlan(planId, price, period, freeTrial, maxActive,
                                   minPeriods, gracePeriod, canPause, canTransfer)
{
    return {
        name: 'Acme Plan ' + planId,
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

function _createProviderDiscount(discountCode, value, validAfter, expiresAt,
                                 maxUses, planId, applyPeriods, isFixed)
{
    return {
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
