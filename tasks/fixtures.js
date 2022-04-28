const {
    usdcUnits,
    month,
    day
} = require("../utils/units");

const { CaskSDK } = require('@caskprotocol/sdk');

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

    const usdc = await ethers.getContract("MockUSDC");
    await usdc.connect(deployer).mint(consumerA.address, usdcUnits('10000.0'));
    await usdc.connect(consumerA).approve(caskVault.address, usdcUnits('10000.0'));

    await caskVault.connect(consumerA).deposit(usdc.address, usdcUnits('25'));



    // fixture provider plans

    const plans = [];
    const discounts = [];

    plans.push(_createProviderPlan(100, usdcUnits('10'), month,
        7 * day, 0, 0, 7, true, true));

    plans.push(_createProviderPlan(101, usdcUnits('20'), day,
        0, 0, 0, 7, true, true));

    discounts.push(_createProviderDiscount('CODE10', 1000, 0,
        0, 0, 0, 0, false));

    const plansRoot = CaskSDK.utils.plansMerkleRoot(plans);
    const discountsRoot = CaskSDK.utils.discountsMerkleRoot(discounts);

    const signedRoots = await CaskSDK.utils.signMerkleRoots(providerA, 0, plansRoot, discountsRoot);
    console.log(`Generated signature for providerA ${providerA.address} configuration: ${signedRoots}`);

    const profileData = {
        plans: CaskSDK.utils.plansMap(plans),
        discounts: CaskSDK.utils.discountsMap(discounts),
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
        const ipfs = new CaskSDK.ipfs.IPFS({
            pinataApiKey: process.env.PINATA_API_KEY,
            pinataApiSecret: process.env.PINATA_API_SECRET});
        providerCid = await ipfs.save(profileData);
    }
    console.log(`CID: ${providerCid}`);
    console.log(`Profile: ${JSON.stringify(profileData)}`);
    // save provider profile to chain
    await caskSubscriptionPlans.connect(providerA).setProviderProfile(providerA.address, providerCid, 0);


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

    const plansProof = CaskSDK.utils.generatePlanProof(
        provider.address,
        CaskSDK.utils.stringToRef(refString),
        plan.planData,
        profileData.planMerkleRoot,
        CaskSDK.utils.plansMerkleProof(plans, plan)
    );
    const discountProof = CaskSDK.utils.generateDiscountProof(
        0,
        0,
        profileData.discountMerkleRoot
    );

    let subscriptionCid = "";
    if (process.env.PINATA_API_KEY) {
        const ipfs = new CaskSDK.ipfs.IPFS({
            pinataApiKey: process.env.PINATA_API_KEY,
            pinataApiSecret: process.env.PINATA_API_SECRET});
        subscriptionCid = await ipfs.save({
            consumer: consumer.address,
            ref: refString,
            planId: planId,
            image: profileData.metadata.iconUrl,
        });
    }

    // create subscription
    const tx = await caskSubscriptions.connect(consumer).createSubscription(
        0, // nonce
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
        planData: CaskSDK.utils.encodePlanData(
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
        discountId: CaskSDK.utils.generateDiscountId(discountCode),
        discountData: CaskSDK.utils.encodeDiscountData(
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
