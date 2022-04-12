const { expect } = require("chai");
const { CaskSDK } = require('@caskprotocol/sdk');

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

        let result;

        const ref = ethers.utils.id("user1");

        const plan = plans.find((p) => p.planId === 200);
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

        await advanceTimeRunSubscriptionKeeper(8, day); // trial end

        // normal trial end
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('140'));

        await advanceTimeRunSubscriptionKeeper(31, day); // next month

        // normal renewal pre-upgrade
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('130'));
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(SubscriptionStatus.Active);
        expect(result.subscription.planId).to.equal(plan.planId);

        const newPlan = plans.find((p) => p.planId === 201);
        const newPlansProof = CaskSDK.utils.generatePlanProof(newPlan.provider, 0, newPlan.planData, plansRoot,
            CaskSDK.utils.plansMerkleProof(plans, newPlan));

        // upgrade subscription from plan 200 -> 201
        expect (await consumerASubscriptions.changeSubscriptionPlan(
            subscriptionId,
            0, // nonce
            newPlansProof, // planProof
            [], // discountProof
            signedRoots, // providerSignature
            "" // cid
        )).to.emit(consumerASubscriptions, "SubscriptionChangedPlan");

        // upgrade used some funds
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.lt(daiUnits('130'));

        await advanceTimeRunSubscriptionKeeper(31, day); // next month

        // upgrade used some funds and new plan is 20, so should have less than 110
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.lt(daiUnits('110'));
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(SubscriptionStatus.Active);
        expect(result.subscription.planId).to.equal(newPlan.planId);

    });

});
