const { expect } = require("chai");

const {
  loadFixture,
  daiUnits,
  advanceTime,
  day,
  month,
  runSubscriptionKeeper,
} = require("./_helpers");

const {
  singlePlanFixture,
  unpausablePlanFixture,
  minTermPlanFixture,
} = require("./fixtures/subscriptions");

// keep in sync with ICaskSubscriptions.sol
const SubscriptionStatus = {
  None: 0,
  Trialing: 1,
  Active: 2,
  Paused: 3,
  Canceled: 4,
  PendingCancel: 5,
  PastDue: 6,
};

// keep in sync with ICaskSubscriptionPlans.sol
const PlanStatus = {
  None: 0,
  Enabled: 1,
  Disabled: 2,
  EndOfLife: 3,
};


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
      consumerA,
      planId,
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

    let subscriptionInfo;
    let keeperLimit = 10;

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

    await runSubscriptionKeeper(keeperLimit);

    // confirm no charge immediately due to 7 day trial
    expect(await consumerVault.currentValueOf(consumerA.address)).to.equal(daiUnits('100'));

    await advanceTime(5 * day); // now day 5
    await runSubscriptionKeeper(keeperLimit);

    // confirm no charge before 7 day trial ends
    expect(await consumerVault.currentValueOf(consumerA.address)).to.equal(daiUnits('100'));

    await advanceTime(3 * day); // now day 8
    expect(await runSubscriptionKeeper(keeperLimit)).to.emit(consumerSubscription, "SubscriptionTrialEnded");

    // confirm charge after 7 day trial ended
    expect(await consumerVault.currentValueOf(consumerA.address)).to.equal(daiUnits('90'));
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.paymentNumber).to.equal(1);

    await advanceTime(month); // 1 month + 1 day after trial ended
    expect(await runSubscriptionKeeper(keeperLimit)).to.emit(consumerSubscription, "SubscriptionRenewed");

    // confirm charge after another month
    expect(await consumerVault.currentValueOf(consumerA.address)).to.equal(daiUnits('80'));
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.paymentNumber).to.equal(2);

    await advanceTime(month);  // 2 month + 1 day after trial ended
    expect(await runSubscriptionKeeper(keeperLimit)).to.emit(consumerSubscription, "SubscriptionRenewed");

    // confirm charge after another month
    expect(await consumerVault.currentValueOf(consumerA.address)).to.equal(daiUnits('70'));
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.paymentNumber).to.equal(3);

    // cancel
    expect(await consumerSubscription.cancelSubscription(subscriptionId))
        .to.emit(consumerSubscription, "SubscriptionPendingCancel");

    await advanceTime(month + day);
    expect(await runSubscriptionKeeper(keeperLimit)).to.emit(consumerSubscription, "SubscriptionCanceled");

    // confirm no charges after cancel
    expect(await consumerVault.currentValueOf(consumerA.address)).to.equal(daiUnits('70'));
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.paymentNumber).to.equal(3);

    await advanceTime(month);
    await runSubscriptionKeeper(keeperLimit);

    // confirm still no charges after cancel
    expect(await consumerVault.currentValueOf(consumerA.address)).to.equal(daiUnits('70'));
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.paymentNumber).to.equal(3);

  });

  it("Past due and no funds cancel flow", async function () {

    const {
      networkAddresses,
      consumerA,
      planId,
      vault,
      subscriptions
    } = await loadFixture(singlePlanFixture);

    const consumerVault = vault.connect(consumerA);
    const consumerSubscription = subscriptions.connect(consumerA);


    // deposit to vault
    await consumerVault.deposit(networkAddresses.DAI, daiUnits('20'));

    let subscriptionInfo;
    let keeperLimit = 10;

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

    // confirm conversion to paid after trial
    await advanceTime(8 * day);
    expect(await runSubscriptionKeeper(keeperLimit)).to.emit(consumerSubscription, "SubscriptionTrialEnded");
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);
    expect(await consumerVault.currentValueOf(consumerA.address)).to.equal(daiUnits('10'));

    // funds just enough for one renewal
    await advanceTime(month);
    expect(await runSubscriptionKeeper(keeperLimit)).to.emit(consumerSubscription, "SubscriptionRenewed");

    // confirm subscription still active but out of funds
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);
    expect(await consumerVault.currentValueOf(consumerA.address)).to.equal('0');

    // unable to renew due to out of funds, confirm past due
    await advanceTime(month);
    expect(await runSubscriptionKeeper(keeperLimit)).to.emit(consumerSubscription, "SubscriptionPastDue");
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.status).to.equal(SubscriptionStatus.PastDue);

    // deposit one more months worth
    await consumerVault.deposit(networkAddresses.DAI, daiUnits('10'));

    // confirm successful renew
    expect(await runSubscriptionKeeper(keeperLimit)).to.emit(consumerSubscription, "SubscriptionRenewed");
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);
    expect(await consumerVault.currentValueOf(consumerA.address)).to.equal('0');

    // a month later, since funds are depleted again, confirm past due
    await advanceTime(month);
    expect(await runSubscriptionKeeper(keeperLimit)).to.emit(consumerSubscription, "SubscriptionPastDue");
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.status).to.equal(SubscriptionStatus.PastDue);

    // past due window passes, subscription cancels
    await advanceTime(8 * day);
    expect(await runSubscriptionKeeper(keeperLimit)).to.emit(consumerSubscription, "SubscriptionCanceled");
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Canceled);

  });

  it("Unpausable plan cannot be paused", async function () {

    const {
      networkAddresses,
      consumerA,
      planId,
      vault,
      subscriptions
    } = await loadFixture(unpausablePlanFixture);

    const consumerVault = vault.connect(consumerA);
    const consumerSubscription = subscriptions.connect(consumerA);


    // deposit to vault
    await consumerVault.deposit(networkAddresses.DAI, daiUnits('30'));

    let subscriptionInfo;
    let keeperLimit = 10;

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


    await advanceTime(month);
    await runSubscriptionKeeper(keeperLimit);
    await advanceTime(month);
    await runSubscriptionKeeper(keeperLimit);

    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);

    await expect(consumerSubscription.pauseSubscription(subscriptionId)).to.be.revertedWith("!NOT_PAUSABLE");

  });

  it("Pause respects minTerm and stops payments while paused", async function () {

    const {
      networkAddresses,
      consumerA,
      planId,
      vault,
      subscriptions
    } = await loadFixture(minTermPlanFixture);

    const consumerVault = vault.connect(consumerA);
    const consumerSubscription = subscriptions.connect(consumerA);


    // deposit to vault
    await consumerVault.deposit(networkAddresses.DAI, daiUnits('150'));

    let subscriptionInfo;
    let keeperLimit = 10;

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

    await advanceTime(month + day);
    await runSubscriptionKeeper(keeperLimit);

    // confirm pause and cancel before min term fail
    await expect(consumerSubscription.pauseSubscription(subscriptionId)).to.be.revertedWith("!MIN_TERM");
    await expect(consumerSubscription.cancelSubscription(subscriptionId)).to.be.revertedWith("!MIN_TERM");

    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);

    // 1 year of renewals - 13 months total
    for (let i = 0; i < 12; i++) {
      await advanceTime(month);
      await runSubscriptionKeeper(keeperLimit);
    }

    // confirm current state after 13 months
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);
    expect(subscriptionInfo.paymentNumber).to.equal(13);

    // pause and confirm now that min term has elapsed
    expect(await consumerSubscription.pauseSubscription(subscriptionId))
        .to.emit(consumerSubscription, "SubscriptionPaused");
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Paused);

    // pause 2 months
    await advanceTime(month); // 14 months
    await runSubscriptionKeeper(keeperLimit);
    await advanceTime(month); // 15 months
    await runSubscriptionKeeper(keeperLimit);

    // resume subscription - confirm no payment while paused
    expect(await consumerSubscription.resumeSubscription(subscriptionId))
        .to.emit(consumerSubscription, "SubscriptionResumed");
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);
    expect(subscriptionInfo.paymentNumber).to.equal(13);

    await advanceTime(month); // 16 months
    await runSubscriptionKeeper(keeperLimit);

    // confirm new payment after resume
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Active);
    expect(subscriptionInfo.paymentNumber).to.equal(14);

    // cancel and confirm will cancel at next renewal
    expect(await consumerSubscription.cancelSubscription(subscriptionId))
        .to.emit(consumerSubscription, "SubscriptionPendingCancel");
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.status).to.equal(SubscriptionStatus.PendingCancel);

    await advanceTime(month); // 17 months
    expect(await runSubscriptionKeeper(keeperLimit)).to.emit(consumerSubscription, "SubscriptionCanceled");

    // confirm canceled
    subscriptionInfo = await consumerSubscription.getSubscription(subscriptionId);
    expect(subscriptionInfo.status).to.equal(SubscriptionStatus.Canceled);

  });

});
