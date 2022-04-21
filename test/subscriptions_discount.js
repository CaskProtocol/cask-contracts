const { expect } = require("chai");
const { CaskSDK } = require('@caskprotocol/sdk');

const {
    usdcUnits,
    day,
} = require("../utils/units");

const {
    advanceTimeRunSubscriptionKeeper,
} = require("./_helpers");

const {
    onePlanWithDiscountsFixture,
} = require("./fixtures/subscriptions");


describe("CaskSubscriptions Discount", function () {

    it("Subscription with discount works", async function () {

        const {
            networkAddresses,
            consumerA,
            vault,
            subscriptions,
            plans,
            discounts,
            plansRoot,
            discountsRoot,
            signedRoots,
        } = await onePlanWithDiscountsFixture();

        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialConsumerBalance = await consumerAVault.currentValueOf(consumerA.address);
        expect(initialConsumerBalance).to.equal(usdcUnits('100'));

        let result;

        const ref = ethers.utils.id("user1");

        const plan = plans.find((p) => p.planId === 501);
        const plansProof = CaskSDK.utils.generatePlanProof(plan.provider, ref, plan.planData, plansRoot,
            CaskSDK.utils.plansMerkleProof(plans, plan));

        const discountCodeProof = CaskSDK.utils.generateDiscountCodeProof("discount1");
        const discount = CaskSDK.utils.lookupDiscount(discountCodeProof, discounts);
        let discountProof = [];
        if (discount) {
            discountProof = CaskSDK.utils.generateDiscountProof(discountCodeProof, discount.discountData, discountsRoot,
                CaskSDK.utils.discountsMerkleProof(discounts, discount));
        } else {
            discountProof = CaskSDK.utils.generateDiscountProof(0, 0, discountsRoot)
        }

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

        await advanceTimeRunSubscriptionKeeper(8, day); // past trial

        // confirm discounted charge after 7 day trial ended - 50% off 10/month == 5; 100 - 5 == 95
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('95'));
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.discountId).to.not.equal(ethers.utils.hexZeroPad(0, 32));


    });

});
