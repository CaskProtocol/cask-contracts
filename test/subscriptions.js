const { expect } = require("chai");

const {
  daiUnits,
  day,
  month,
  runSubscriptionKeeper,
  advanceTimeRunSubscriptionKeeper,
} = require("./_helpers");

const {
  onePlanFixture,
} = require("./fixtures/subscriptions");


describe("CaskSubscriptions General", function () {

  it("Basic subscription lifecycle", async function () {

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
    await consumerAVault.deposit(networkAddresses.DAI, daiUnits('100'));

    // check initial balance
    const initialConsumerBalance = await consumerAVault.currentValueOf(consumerA.address);
    expect(initialConsumerBalance).to.equal(daiUnits('100'));

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
    expect(subscriptionId).to.not.be.undefined;

    await runSubscriptionKeeper();

    // confirm no charge immediately due to 7 day trial
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('100'));

    await advanceTimeRunSubscriptionKeeper(1, 5 * day);

    // confirm no charge before 7 day trial ends
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('100'));

    expect(await advanceTimeRunSubscriptionKeeper(1, day * 3))
        .to.emit(consumerASubscriptions, "SubscriptionTrialEnded");

    // confirm charge after 7 day trial ended
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('90'));
    subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
    expect(subscriptionInfo.paymentNumber).to.equal(1);
    expect(subscriptionInfo.discountId).to.equal(ethers.utils.hexZeroPad(0, 32)); // no discount code

    expect(await advanceTimeRunSubscriptionKeeper(1, month))
        .to.emit(consumerASubscriptions, "SubscriptionRenewed");

    // confirm charge after another month
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('80'));
    subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
    expect(subscriptionInfo.paymentNumber).to.equal(2);

    expect(await advanceTimeRunSubscriptionKeeper(1, month))
        .to.emit(consumerASubscriptions, "SubscriptionRenewed");

    // confirm charge after another month
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('70'));
    subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
    expect(subscriptionInfo.paymentNumber).to.equal(3);

    // cancel
    expect(await consumerASubscriptions.cancelSubscription(subscriptionId))
        .to.emit(consumerASubscriptions, "SubscriptionPendingCancel");

    expect(await advanceTimeRunSubscriptionKeeper(1, month + day))
        .to.emit(consumerASubscriptions, "SubscriptionCanceled");

    // confirm no charges after cancel
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('70'));
    subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
    expect(subscriptionInfo.paymentNumber).to.equal(3);

    await advanceTimeRunSubscriptionKeeper(1, month);

    // confirm still no charges after cancel
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('70'));
    subscriptionInfo = await consumerASubscriptions.getSubscription(subscriptionId);
    expect(subscriptionInfo.paymentNumber).to.equal(3);

  });

});
