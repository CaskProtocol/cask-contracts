const { expect } = require("chai");
const { CaskSDK } = require('@caskprotocol/sdk');

const {
    usdcUnits,
    day, month,
} = require("../utils/units");

const {
    advanceTimeRunSubscriptionKeeper,
} = require("./_helpers");

const {
    protocolFixture,
} = require("./fixtures/subscriptions");


describe("CaskSubscriptions Bad Values", function () {

    it("Subscription no trial price too low", async function () {

        const {
            networkAddresses,
            consumerA,
            providerA,
            plans,
            discounts,
            vault,
            subscriptions
        } = await protocolFixture();

        plans.push({
            provider: providerA.address,
            planId: 100,
            planData: CaskSDK.utils.encodePlanData(
                100, // planId
                usdcUnits('0.01'), // price
                month, // period
                0, // freeTrial
                0, // maxActive
                0, // minPeriods
                7, // gracePeriod
                true, // canPause
                true) // canTransfer
        });

        const plansRoot = CaskSDK.utils.plansMerkleRoot(plans);
        const discountsRoot = CaskSDK.utils.discountsMerkleRoot(discounts);
        const signedRoots = await CaskSDK.utils.signMerkleRoots(providerA, 0, plansRoot, discountsRoot);


        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialConsumerBalance = await consumerAVault.currentValueOf(consumerA.address);
        expect(initialConsumerBalance).to.equal(usdcUnits('100'));


        const ref = ethers.utils.id("user1");

        const plan = plans.find((p) => p.planId === 100);
        const plansProof = CaskSDK.utils.generatePlanProof(plan.provider, ref, plan.planData, plansRoot,
            CaskSDK.utils.plansMerkleProof(plans, plan));
        const discountProof = CaskSDK.utils.generateDiscountProof(0, 0, discountsRoot)


        await expect(consumerASubscriptions.createSubscription(
            0, // nonce
            plansProof, // planProof
            discountProof, // discountProof
            0, // cancelAt
            signedRoots, // providerSignature
            "" // cid
        )).to.be.revertedWith("!UNPROCESSABLE");

    });

    it("Subscription with trial price too low", async function () {

        const {
            networkAddresses,
            consumerA,
            providerA,
            plans,
            discounts,
            vault,
            subscriptions
        } = await protocolFixture();

        plans.push({
            provider: providerA.address,
            planId: 100,
            planData: CaskSDK.utils.encodePlanData(
                100, // planId
                usdcUnits('0.01'), // price
                month, // period
                3 * 86400, // freeTrial
                0, // maxActive
                0, // minPeriods
                7, // gracePeriod
                true, // canPause
                true) // canTransfer
        });

        const plansRoot = CaskSDK.utils.plansMerkleRoot(plans);
        const discountsRoot = CaskSDK.utils.discountsMerkleRoot(discounts);
        const signedRoots = await CaskSDK.utils.signMerkleRoots(providerA, 0, plansRoot, discountsRoot);


        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialConsumerBalance = await consumerAVault.currentValueOf(consumerA.address);
        expect(initialConsumerBalance).to.equal(usdcUnits('100'));


        const ref = ethers.utils.id("user1");

        const plan = plans.find((p) => p.planId === 100);
        const plansProof = CaskSDK.utils.generatePlanProof(plan.provider, ref, plan.planData, plansRoot,
            CaskSDK.utils.plansMerkleProof(plans, plan));
        const discountProof = CaskSDK.utils.generateDiscountProof(0, 0, discountsRoot)


        // create subscription
        const tx = await consumerASubscriptions.createSubscription(
            0, // nonce
            plansProof, // planProof
            discountProof, // discountProof
            0, // cancelAt
            signedRoots, // providerSignature
            "" // cid
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "SubscriptionCreated");
        const subscriptionId = createdEvent.args.subscriptionId;
        expect(subscriptionId).to.not.be.undefined;
        expect(createdEvent.args.provider).to.equal(plan.provider);
        expect(createdEvent.args.planId).to.equal(plan.planId);

        await advanceTimeRunSubscriptionKeeper(5, day);

        // confirm subscription canceled since price was too low
        const result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(CaskSDK.subscriptionStatus.CANCELED);

    });


});
