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


describe("CaskSubscriptions Discount", function () {

    it("Subscription with discount works", async function () {

        const {
            networkAddresses,
            consumerA,
            planId,
            vault,
            subscriptions
        } = await onePlanWithDiscountsFixture();

        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.DAI, daiUnits('100'));

        // check initial balance
        const initialConsumerBalance = await consumerAVault.currentValueOf(consumerA.address);
        expect(initialConsumerBalance).to.equal(daiUnits('100'));

        let subscriptionInfo;


        const discountProof = ethers.utils.id("discount1");

        // create subscription
        const tx = await consumerASubscriptions.createSubscription(
            planId, // planId
            discountProof, // discountProof - see docs for format details
            ethers.utils.formatBytes32String("sub1"), // ref
            0, // cancelAt
            ethers.utils.keccak256("0x"), 0, 0 // metaHash, metaHF, metaSize - IPFS CID of subscription metadata
        );
        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "SubscriptionCreated");
        const subscriptionId = createdEvent.args.subscriptionId;
        expect(subscriptionId).to.not.be.undefined;

        await advanceTimeRunSubscriptionKeeper(1, 8 * day); // past trial

        // confirm discounted charge after 7 day trial ended - 50% off 10/month == 5; 100 - 5 == 95
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('95'));
        subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(subscriptionInfo.paymentNumber).to.equal(1);
        expect(subscriptionInfo.discountId).to.not.equal(ethers.utils.hexZeroPad(0, 32));


    });

});
