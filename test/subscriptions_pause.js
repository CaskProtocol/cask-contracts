const { expect } = require("chai");

const {
    daiUnits,
    day,
    month,
} = require("../utils/units");

const {
    SubscriptionStatus,
    advanceTimeRunSubscriptionKeeper,
} = require("./_helpers");

const {
    unpausablePlanFixture,
    minTermPlanFixture,
} = require("./fixtures/subscriptions");

const {
    generatePlanProof,
    plansMerkleProof,
    generateDiscountProof,
} = require("../utils/plans");


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
        await consumerAVault.deposit(networkAddresses.DAI, daiUnits('30'));

        let subscriptionInfo;

        const ref = ethers.utils.id("user1");

        const plan = plans.find((p) => p.planId === 301);
        const plansProof = generatePlanProof(plan.provider, ref, plan.planData, plansRoot,
            plansMerkleProof(plans, plan));
        const discountProof = generateDiscountProof(0, 0, discountsRoot)

        // create subscription
        const tx = await consumerASubscriptions.createSubscription(
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

        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);

        await expect(consumerASubscriptions.pauseSubscription(subscriptionId)).to.be.revertedWith("!NOT_PAUSABLE");

    });

    it("Pause respects minTerm and stops payments while paused", async function () {

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
        await consumerAVault.deposit(networkAddresses.DAI, daiUnits('150'));

        let subscriptionInfo;

        const ref = ethers.utils.id("user1");

        const plan = plans.find((p) => p.planId === 401);
        const plansProof = generatePlanProof(plan.provider, ref, plan.planData, plansRoot,
            plansMerkleProof(plans, plan));
        const discountProof = generateDiscountProof(0, 0, discountsRoot)

        // create subscription
        const tx = await consumerASubscriptions.createSubscription(
            plansProof, // planProof
            discountProof, // discountProof
            0, // cancelAt
            signedRoots, // providerSignature
            "" // cid
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "SubscriptionCreated");
        const subscriptionId = createdEvent.args.subscriptionId;

        await advanceTimeRunSubscriptionKeeper(1, month + day)

        // confirm pause and cancel before min term fail
        await expect(consumerASubscriptions.pauseSubscription(subscriptionId)).to.be.revertedWith("!MIN_TERM");
        await expect(consumerASubscriptions.cancelSubscription(subscriptionId)).to.be.revertedWith("!MIN_TERM");

        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);

        await advanceTimeRunSubscriptionKeeper(12, month);

        // confirm current state after 13 months
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);

        // pause and confirm now that min term has elapsed
        expect(await consumerASubscriptions.pauseSubscription(subscriptionId))
            .to.emit(consumerASubscriptions, "SubscriptionPaused");
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Paused);

        await advanceTimeRunSubscriptionKeeper(2, month);

        // resume subscription - confirm no payment while paused
        expect(await consumerASubscriptions.resumeSubscription(subscriptionId))
            .to.emit(consumerASubscriptions, "SubscriptionResumed");
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);

        await advanceTimeRunSubscriptionKeeper(1, month);

        // confirm new payment after resume
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);

        // cancel and confirm will cancel at next renewal
        expect(await consumerASubscriptions.cancelSubscription(subscriptionId))
            .to.emit(consumerASubscriptions, "SubscriptionPendingCancel");
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.PendingCancel);

        expect (await advanceTimeRunSubscriptionKeeper(1, month))
            .to.emit(consumerASubscriptions, "SubscriptionCanceled");

        // confirm canceled
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Canceled);

    });

});
