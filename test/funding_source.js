const { expect } = require("chai");
const { CaskSDK } = require('@caskprotocol/sdk');

const {
    usdcUnits,
    day, daiUnits,
} = require("../utils/units");

const {
    runSubscriptionKeeper,
    advanceTimeRunSubscriptionKeeper,
} = require("./_helpers");

const {
    onePlanFixture,
} = require("./fixtures/subscriptions");


describe("FundingSource", function () {

    it("Basic subscription lifecycle with personal funding source base asset", async function () {

        const {
            networkAddresses,
            consumerA,
            plans,
            plansRoot,
            discountsRoot,
            signedRoots,
            vault,
            subscriptions
        } = await onePlanFixture();

        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);

        const usdc = await ethers.getContract("MockUSDC");

        // change funding source to personal USDC balance
        await consumerAVault.setFundingSource(1, usdc.address);

        // check initial balance
        expect(await usdc.balanceOf(consumerA.address)).to.equal(usdcUnits('10000'));


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
        expect(subscriptionId).to.not.be.undefined;
        expect(createdEvent.args.provider).to.equal(plan.provider);
        expect(createdEvent.args.planId).to.equal(plan.planId);

        await runSubscriptionKeeper();

        // confirm no charge immediately due to 7 day trial
        expect(await usdc.balanceOf(consumerA.address)).to.equal(usdcUnits('10000'));

        await advanceTimeRunSubscriptionKeeper(5, day);

        // confirm no charge before 7 day trial ends
        expect(await usdc.balanceOf(consumerA.address)).to.equal(usdcUnits('10000'));

        await advanceTimeRunSubscriptionKeeper(3, day);

        // confirm charge after 7 day trial ended
        expect(await usdc.balanceOf(consumerA.address)).to.equal(usdcUnits('9990'));
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.discountId).to.equal(ethers.utils.hexZeroPad(0, 32)); // no discount code

        await advanceTimeRunSubscriptionKeeper(31, day);

        // confirm charge after another month
        expect(await usdc.balanceOf(consumerA.address)).to.equal(usdcUnits('9980'));
        result = await consumerASubscriptions.getSubscription(subscriptionId);

        await advanceTimeRunSubscriptionKeeper(31, day);

        // confirm charge after another month
        expect(await usdc.balanceOf(consumerA.address)).to.equal(usdcUnits('9970'));
        result = await consumerASubscriptions.getSubscription(subscriptionId);

        // cancel
        expect(await consumerASubscriptions.cancelSubscription(subscriptionId, result.subscription.renewAt))
            .to.emit(consumerASubscriptions, "SubscriptionPendingCancel");

        await advanceTimeRunSubscriptionKeeper(32, day);

        // confirm no charges after cancel
        expect(await usdc.balanceOf(consumerA.address)).to.equal(usdcUnits('9970'));
        result = await consumerASubscriptions.getSubscription(subscriptionId);

        await advanceTimeRunSubscriptionKeeper(31, day);

        // confirm still no charges after cancel
        expect(await usdc.balanceOf(consumerA.address)).to.equal(usdcUnits('9970'));
        result = await consumerASubscriptions.getSubscription(subscriptionId);

    });

    it("Basic subscription lifecycle with personal funding source non base asset", async function () {

        const {
            networkAddresses,
            consumerA,
            plans,
            plansRoot,
            discountsRoot,
            signedRoots,
            vault,
            subscriptions
        } = await onePlanFixture();

        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);

        const dai = await ethers.getContract("MockDAI");

        // change funding source to personal DAI balance
        await consumerAVault.setFundingSource(1, dai.address);

        // check initial balance
        expect(await dai.balanceOf(consumerA.address)).to.equal(daiUnits('10000'));


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
        expect(subscriptionId).to.not.be.undefined;
        expect(createdEvent.args.provider).to.equal(plan.provider);
        expect(createdEvent.args.planId).to.equal(plan.planId);

        await runSubscriptionKeeper();

        // confirm no charge immediately due to 7 day trial
        expect(await dai.balanceOf(consumerA.address)).to.equal(daiUnits('10000'));

        await advanceTimeRunSubscriptionKeeper(5, day);

        // confirm no charge before 7 day trial ends
        expect(await dai.balanceOf(consumerA.address)).to.equal(daiUnits('10000'));

        await advanceTimeRunSubscriptionKeeper(3, day);

        // confirm charge after 7 day trial ended
        expect(await dai.balanceOf(consumerA.address)).to.equal(daiUnits('9989.989')); // includes 0.01 slippage
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.discountId).to.equal(ethers.utils.hexZeroPad(0, 32)); // no discount code

        await advanceTimeRunSubscriptionKeeper(31, day);

        // confirm charge after another month
        expect(await dai.balanceOf(consumerA.address)).to.equal(daiUnits('9979.978')); // includes 0.01 slippage
        result = await consumerASubscriptions.getSubscription(subscriptionId);

        await advanceTimeRunSubscriptionKeeper(31, day);

        // confirm charge after another month
        expect(await dai.balanceOf(consumerA.address)).to.equal(daiUnits('9969.967')); // includes 0.01 slippage
        result = await consumerASubscriptions.getSubscription(subscriptionId);

        // cancel
        expect(await consumerASubscriptions.cancelSubscription(subscriptionId, result.subscription.renewAt))
            .to.emit(consumerASubscriptions, "SubscriptionPendingCancel");

        await advanceTimeRunSubscriptionKeeper(32, day);

        // confirm no charges after cancel
        expect(await dai.balanceOf(consumerA.address)).to.equal(daiUnits('9969.967')); // includes 0.01 slippage
        result = await consumerASubscriptions.getSubscription(subscriptionId);

        await advanceTimeRunSubscriptionKeeper(31, day);

        // confirm still no charges after cancel
        expect(await dai.balanceOf(consumerA.address)).to.equal(daiUnits('9969.967'));
        result = await consumerASubscriptions.getSubscription(subscriptionId);

    });

});
