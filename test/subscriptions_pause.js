const { expect } = require("chai");
const { CaskSDK } = require('@caskprotocol/sdk');

const {
    usdcUnits,
    day,
    month,
    now,
} = require("../utils/units");

const {
    SubscriptionStatus,
    advanceTimeRunSubscriptionKeeper,
} = require("./_helpers");

const {
    unpausablePlanFixture,
    minTermPlanFixture,
} = require("./fixtures/subscriptions");


describe("CaskSubscriptions Pause", function () {

    it("Unpausable plan cannot be paused", async function () {

        const {
            networkAddresses,
            consumerA,
            vault,
            subscriptions,
            plans,
            plansRoot,
            discountsRoot,
            signedRoots,
        } = await unpausablePlanFixture();

        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.USDC, usdcUnits('30'));

        let result;

        const ref = ethers.utils.id("user1");

        const plan = plans.find((p) => p.planId === 301);
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

        await advanceTimeRunSubscriptionKeeper(2, month);

        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(SubscriptionStatus.Active);

        await expect(consumerASubscriptions.pauseSubscription(subscriptionId)).to.be.revertedWith("!NOT_PAUSABLE");

    });

    it("Pause respects minTerm and stops payments while paused", async function () {
        this.timeout(0);

        const {
            networkAddresses,
            consumerA,
            vault,
            subscriptions,
            plans,
            plansRoot,
            discountsRoot,
            signedRoots,
        } = await minTermPlanFixture();

        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.USDC, usdcUnits('150'));

        let result;

        const ref = ethers.utils.id("user1");

        const plan = plans.find((p) => p.planId === 401);
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

        await advanceTimeRunSubscriptionKeeper(32, day)

        // confirm pause and cancel before min term fail
        await expect(consumerASubscriptions.pauseSubscription(subscriptionId)).to.be.revertedWith("!MIN_TERM");
        await expect(consumerASubscriptions.cancelSubscription(subscriptionId, now)).to.be.revertedWith("!MIN_TERM");

        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(SubscriptionStatus.Active);

        await advanceTimeRunSubscriptionKeeper(365, day);

        // confirm current state after 13 months
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(SubscriptionStatus.Active);

        // pause and confirm now that min term has elapsed
        expect(await consumerASubscriptions.pauseSubscription(subscriptionId))
            .to.emit(consumerASubscriptions, "SubscriptionPendingPause");
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(SubscriptionStatus.PendingPause);

        await advanceTimeRunSubscriptionKeeper(1, day);

        // make sure we can change our mind
        await consumerASubscriptions.resumeSubscription(subscriptionId);
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(SubscriptionStatus.Active);

        await advanceTimeRunSubscriptionKeeper(1, day);

        // pause and confirm now that min term has elapsed
        expect(await consumerASubscriptions.pauseSubscription(subscriptionId))
            .to.emit(consumerASubscriptions, "SubscriptionPendingPause");
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(SubscriptionStatus.PendingPause);

        await advanceTimeRunSubscriptionKeeper(30, day);

        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(SubscriptionStatus.Paused);

        await advanceTimeRunSubscriptionKeeper(31, day);

        // resume subscription - confirm no payment while paused
        expect(await consumerASubscriptions.resumeSubscription(subscriptionId))
            .to.emit(consumerASubscriptions, "SubscriptionResumed");
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(SubscriptionStatus.Active);

        await advanceTimeRunSubscriptionKeeper(31, day);

        // confirm new payment after resume
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(SubscriptionStatus.Active);

        // cancel immediately
        expect(await consumerASubscriptions.cancelSubscription(subscriptionId, 1))
            .to.emit(consumerASubscriptions, "SubscriptionCanceled");

    });

});
