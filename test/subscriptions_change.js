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


describe("CaskSubscriptions Change", function () {

    it("Subscribe and upgrade", async function () {

        const {
            networkAddresses,
            consumerA,
            planAId,
            planBId,
            vault,
            subscriptions
        } = await twoPlanFixture();

        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.DAI, daiUnits('150'));

        let subscriptionInfo;

        // create subscription
        const tx = await consumerASubscriptions.createSubscription(
            planAId, // planId
            ethers.utils.id(""), // discountProof - keccak256 hash of bytes of discount code string
            ethers.utils.formatBytes32String("sub1"), // ref
            0, // cancelAt
            ethers.utils.keccak256("0x"), 0, 0 // metaHash, metaHF, metaSize - IPFS CID of subscription metadata
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
        expect(subscriptionInfo.planId).to.equal(planAId);

        expect(await consumerASubscriptions.changeSubscriptionPlan(subscriptionId, planBId,
            ethers.utils.id(""), false)).to.emit(consumerASubscriptions, "SubscriptionChangedPlan");

        // upgrade used some funds
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.lt(daiUnits('130'));

        await advanceTimeRunSubscriptionKeeper(1, month); // next month

        // upgrade used some funds and new plan is 20, so should have less than 110
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.lt(daiUnits('110'));
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);
        expect(subscriptionInfo.planId).to.equal(planBId);

    });

});
