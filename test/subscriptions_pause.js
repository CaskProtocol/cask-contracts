const { expect } = require("chai");

const {
    loadFixture,
    daiUnits,
    SubscriptionStatus,
    day,
    month,
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
            planId,
            vault,
            subscriptions
        } = await loadFixture(unpausablePlanFixture);

        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.DAI, daiUnits('30'));

        let subscriptionInfo;

        // create subscription
        const tx = await consumerASubscriptions.createSubscription(
            planId, // planId
            ethers.utils.id(""), // discountProof - keccak256 hash of bytes of discount code string
            ethers.utils.formatBytes32String("sub1"), // ref
            0, // cancelAt
            ethers.utils.keccak256("0x"), 0, 0 // metaHash, metaHF, metaSize - IPFS CID of subscription metadata
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
            planId,
            vault,
            subscriptions
        } = await loadFixture(minTermPlanFixture);

        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.DAI, daiUnits('150'));

        let subscriptionInfo;

        // create subscription
        const tx = await consumerASubscriptions.createSubscription(
            planId, // planId
            ethers.utils.id(""), // discountProof - keccak256 hash of bytes of discount code string
            ethers.utils.formatBytes32String("sub1"), // ref
            0, // cancelAt
            ethers.utils.keccak256("0x"), 0, 0 // metaHash, metaHF, metaSize - IPFS CID of subscription metadata
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
        expect(subscriptionInfo.paymentNumber).to.equal(13);

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
        expect(subscriptionInfo.paymentNumber).to.equal(13);

        await advanceTimeRunSubscriptionKeeper(1, month);

        // confirm new payment after resume
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);
        expect(subscriptionInfo.paymentNumber).to.equal(14);

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
