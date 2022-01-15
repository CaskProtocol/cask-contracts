const { expect } = require("chai");

const {
  loadFixture,
  usdcUnits,
  daiUnits,
  usdtUnits,
  advanceTime,
  day,
  month,
  subscriptionCheckUpkeep,
  runSubscriptionKeeper,
} = require("./_helpers");

const {
  singlePlanFixture,
} = require("./fixtures/subscriptions");


describe("CaskSubscriptions", function () {

  it("Create a subscription successfully", async function () {

    const {
      providerA,
      consumerA,
      planId,
      planCode,
      subscriptions
    } = await loadFixture(singlePlanFixture);

    expect(await subscriptions.getConsumerSubscriptionCount(consumerA.address)).to.equal("0");

    const ref = ethers.utils.formatBytes32String("sub1");

    const tx = await subscriptions.connect(consumerA).createSubscription(
        planId, // planId
        ethers.utils.id(""), // discountProof - keccak256 hash of bytes of discount code string
        ref, // ref
        0, // cancelAt
        ethers.utils.keccak256("0x"), 0, 0 // metaHash, metaHF, metaSize - IPFS CID of subscription metadata
    );
    const events = (await tx.wait()).events || [];
    const createdEvent = events.find((e) => e.event === "SubscriptionCreated");

    expect(createdEvent).to.not.be.undefined;
    expect(createdEvent.args.provider).to.equal(providerA.address);
    expect(createdEvent.args.consumer).to.equal(consumerA.address);
    expect(createdEvent.args.planCode).to.equal(planCode);
    expect(createdEvent.args.ref).to.equal(ref);
    expect(createdEvent.args.subscriptionId).to.not.be.undefined;

    expect(await subscriptions.getConsumerSubscriptionCount(consumerA.address)).to.equal("1");

  });


  it("Basic subscription lifecycle", async function () {

    const {
      networkAddresses,
      providerA,
      consumerA,
      planId,
      planCode,
      vault,
      subscriptions
    } = await loadFixture(singlePlanFixture);

    const consumerVault = vault.connect(consumerA);
    const consumerSubscription = subscriptions.connect(consumerA);


    // deposit to vault
    await consumerVault.deposit(networkAddresses.DAI, daiUnits('100'));

    // check initial balance
    const initialConsumerBalance = await consumerVault.currentValueOf(consumerA.address);
    expect(initialConsumerBalance).to.equal(daiUnits('100'));

    let balance = 0;
    let subscriptionInfo;

    // create subscription
    const tx = await consumerSubscription.createSubscription(
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

    await runSubscriptionKeeper(10);

    // confirm no charge immediately due to 7 day trial
    balance = await consumerVault.currentValueOf(consumerA.address);
    expect(balance).to.equal(daiUnits('100'));

    await advanceTime(5 * day); // now day 5
    await runSubscriptionKeeper(10);

    // confirm no charge before 7 day trial ends
    balance = await consumerVault.currentValueOf(consumerA.address);
    expect(balance).to.equal(daiUnits('100'));

    await advanceTime(3 * day); // now day 8
    expect(await runSubscriptionKeeper(10)).to.emit(consumerSubscription, "SubscriptionTrialEnded");

    // confirm charge after 7 day trial ended
    balance = await consumerVault.currentValueOf(consumerA.address);
    expect(balance).to.equal(daiUnits('90'));
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.paymentNumber).to.equal(1);

    await advanceTime(month); // 1 month + 1 day after trial ended
    expect(await runSubscriptionKeeper(10)).to.emit(consumerSubscription, "SubscriptionRenewed");

    // confirm charge after another month
    balance = await consumerVault.currentValueOf(consumerA.address);
    expect(balance).to.equal(daiUnits('80'));
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.paymentNumber).to.equal(2);

    await advanceTime(month);  // 2 month + 1 day after trial ended
    expect(await runSubscriptionKeeper(10)).to.emit(consumerSubscription, "SubscriptionRenewed");

    // confirm charge after another month
    balance = await consumerVault.currentValueOf(consumerA.address);
    expect(balance).to.equal(daiUnits('70'));
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.paymentNumber).to.equal(3);

    // cancel
    expect(await consumerSubscription.cancelSubscription(subscriptionId))
        .to.emit(consumerSubscription, "SubscriptionPendingCancel");

    await advanceTime(month + day);
    expect(await runSubscriptionKeeper(10)).to.emit(consumerSubscription, "SubscriptionCanceled");

    // confirm no charges after cancel
    balance = await consumerVault.currentValueOf(consumerA.address);
    expect(balance).to.equal(daiUnits('70'));
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.paymentNumber).to.equal(3);

    await advanceTime(month);
    await runSubscriptionKeeper(10);

    // confirm still no charges after cancel
    balance = await consumerVault.currentValueOf(consumerA.address);
    expect(balance).to.equal(daiUnits('70'));
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.paymentNumber).to.equal(3);


  });

});
