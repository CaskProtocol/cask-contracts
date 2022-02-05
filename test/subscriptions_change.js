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
    twoPlanFixture,
} = require("./fixtures/subscriptions");

const cask = require('@caskprotocol/sdk');


describe("CaskSubscriptions Change", function () {

    it("Subscribe and upgrade", async function () {

        const {
            networkAddresses,
            consumerA,
            vault,
            subscriptions,
            plans,
            plansRoot,
            discountsRoot,
            signedRoots,
        } = await twoPlanFixture();

        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.DAI, daiUnits('150'));

        let subscriptionInfo;

        const ref = ethers.utils.id("user1");

        const plan = plans.find((p) => p.planId === 200);
        const plansProof = cask.utils.generatePlanProof(plan.provider, ref, plan.planData, plansRoot,
            cask.utils.plansMerkleProof(plans, plan));
        const discountProof = cask.utils.generateDiscountProof(0, 0, discountsRoot)

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

        await advanceTimeRunSubscriptionKeeper(8, day); // trial end

        // normal trial end
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('140'));

        await advanceTimeRunSubscriptionKeeper(1, month); // next month

        // normal renewal pre-upgrade
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('130'));
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);
        expect(subscriptionInfo.planId).to.equal(plan.planId);

        const newPlan = plans.find((p) => p.planId === 201);
        const newPlansProof = cask.utils.generatePlanProof(newPlan.provider, 0, newPlan.planData, plansRoot,
            cask.utils.plansMerkleProof(plans, newPlan));

        // upgrade subscription from plan 200 -> 201
        expect (await consumerASubscriptions.changeSubscriptionPlan(
            subscriptionId,
            newPlansProof, // planProof
            [], // discountProof
            signedRoots, // providerSignature
            "" // cid
        )).to.emit(consumerASubscriptions, "SubscriptionChangedPlan");

        // upgrade used some funds
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.lt(daiUnits('130'));

        await advanceTimeRunSubscriptionKeeper(1, month); // next month

        // upgrade used some funds and new plan is 20, so should have less than 110
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.lt(daiUnits('110'));
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);
        expect(subscriptionInfo.planId).to.equal(newPlan.planId);

    });

});
