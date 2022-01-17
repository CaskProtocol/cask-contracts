const { expect } = require("chai");

const {
    daiUnits,
    SubscriptionStatus,
    hour,
    day,
    month,
    advanceTimeRunSubscriptionKeeper,
} = require("./_helpers");

const {
    onePlanFixture,
} = require("./fixtures/subscriptions");


describe("CaskSubscriptions Cancel", function () {

    it("Past due and no funds cancel flow", async function () {

        const {
            networkAddresses,
            consumerA,
            planId,
            vault,
            subscriptions
        } = await onePlanFixture();

        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.DAI, daiUnits('20'));

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

        // confirm conversion to paid after trial
        expect(await advanceTimeRunSubscriptionKeeper(1, 8 * day))
            .to.emit(consumerASubscriptions, "SubscriptionTrialEnded");
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('10'));

        // funds just enough for one renewal
        expect (await advanceTimeRunSubscriptionKeeper(1, month))
            .to.emit(consumerASubscriptions, "SubscriptionRenewed");

        // confirm subscription still active but out of funds
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal('0');

        // unable to renew due to out of funds, confirm past due
        expect (await advanceTimeRunSubscriptionKeeper(1, month))
            .to.emit(consumerASubscriptions, "SubscriptionPastDue");
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.PastDue);

        // deposit one more months worth
        await consumerAVault.deposit(networkAddresses.DAI, daiUnits('10'));

        // confirm successful renew
        expect (await advanceTimeRunSubscriptionKeeper(1, hour))
            .to.emit(consumerASubscriptions, "SubscriptionRenewed");

        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal('0');

        // a month later, since funds are depleted again, confirm past due
        expect (await advanceTimeRunSubscriptionKeeper(1, month))
            .to.emit(consumerASubscriptions, "SubscriptionPastDue");
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.PastDue);

        // past due window passes, subscription cancels
        expect (await advanceTimeRunSubscriptionKeeper(1, 8 * day))
            .to.emit(consumerASubscriptions, "SubscriptionCanceled");
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Canceled);

    });

});
