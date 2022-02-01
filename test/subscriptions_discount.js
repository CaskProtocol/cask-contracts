const { expect } = require("chai");

const {
    daiUnits,
    day,
} = require("../utils/units");

const {
    advanceTimeRunSubscriptionKeeper,
} = require("./_helpers");

const {
    onePlanWithDiscountsFixture,
} = require("./fixtures/subscriptions");
const {
    generatePlanProof,
    plansMerkleProof,
    generateDiscountCodeProof,
    lookupDiscount,
    generateDiscountProof,
    discountsMerkleProof,
} = require("../utils/plans");


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
        await consumerAVault.deposit(networkAddresses.DAI, daiUnits('100'));

        // check initial balance
        const initialConsumerBalance = await consumerAVault.currentValueOf(consumerA.address);
        expect(initialConsumerBalance).to.equal(daiUnits('100'));

        let subscriptionInfo;

        const ref = ethers.utils.id("user1");

        const plan = plans.find((p) => p.planId === 501);
        const plansProof = generatePlanProof(plan.provider, ref, plan.planData, plansRoot,
            plansMerkleProof(plans, plan));

        const discountCodeProof = generateDiscountCodeProof("discount1");
        const discount = lookupDiscount(discountCodeProof, discounts);
        let discountProof = [];
        if (discount) {
            discountProof = generateDiscountProof(discountCodeProof, discount.discountData, discountsRoot,
                discountsMerkleProof(discounts, discount));
        } else {
            discountProof = generateDiscountProof(0, 0, discountsRoot)
        }

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
        expect(subscriptionId).to.not.be.undefined;

        await advanceTimeRunSubscriptionKeeper(1, 8 * day); // past trial

        // confirm discounted charge after 7 day trial ended - 50% off 10/month == 5; 100 - 5 == 95
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('95'));
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.discountId).to.not.equal(ethers.utils.hexZeroPad(0, 32));


    });

});
