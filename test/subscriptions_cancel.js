const { expect } = require("chai");
const { CaskSDK } = require('@caskprotocol/sdk');

const {
    usdcUnits,
    hour,
    day,
    month,
} = require("../utils/units");

const {
    advanceTimeRunSubscriptionKeeper,
} = require("./_helpers");

const {
    onePlanFixture,
} = require("./fixtures/subscriptions");
const hre = require("hardhat");


describe("CaskSubscriptions Cancel", function () {

    it("Past due and no funds cancel flow", async function () {

        const {
            networkAddresses,
            consumerA,
            vault,
            subscriptions,
            plans,
            plansRoot,
            discountsRoot,
            signedRoots,
        } = await onePlanFixture();

        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.USDC, usdcUnits('20'));

        let result;

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

        // confirm conversion to paid after trial
        await advanceTimeRunSubscriptionKeeper(8, day);
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(CaskSDK.subscriptionStatus.ACTIVE);
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('10'));

        // funds just enough for one renewal
        await advanceTimeRunSubscriptionKeeper(31, day);

        // confirm subscription still active but out of funds
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(CaskSDK.subscriptionStatus.ACTIVE);
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal('0');

        // unable to renew due to out of funds, confirm past due
        await advanceTimeRunSubscriptionKeeper(31, day);
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(CaskSDK.subscriptionStatus.PAST_DUE);

        // deposit one more months worth
        await consumerAVault.deposit(networkAddresses.USDC, usdcUnits('10'));

        // confirm successful renew by next day
        await advanceTimeRunSubscriptionKeeper(1, day);

        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(CaskSDK.subscriptionStatus.ACTIVE);
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal('0');

        // a month later, since funds are depleted again, confirm past due
        await advanceTimeRunSubscriptionKeeper(31, day);
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(CaskSDK.subscriptionStatus.PAST_DUE);

        // past due window passes, subscription cancels
        await advanceTimeRunSubscriptionKeeper(8, day);
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.status).to.equal(CaskSDK.subscriptionStatus.CANCELED);

    });

});
