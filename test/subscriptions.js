const { expect } = require("chai");

const {
  loadFixture,
  daiUnits,
  advanceTime,
  hour,
  day,
  month,
  runSubscriptionKeeper,
  advanceTimeRunSubscriptionKeeper, getBlockTimestamp,
} = require("./_helpers");

const {
  onePlanFixture,
  twoPlanFixture,
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
    } = await loadFixture(onePlanFixture);

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
    } = await loadFixture(onePlanFixture);

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

  it("Past due and no funds cancel flow", async function () {

    const {
      networkAddresses,
      consumerA,
      planId,
      vault,
      subscriptions
    } = await loadFixture(onePlanFixture);

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

  it("Subscribe and upgrade", async function () {

    const {
      networkAddresses,
      consumerA,
      planAId,
      planBId,
      vault,
      subscriptions
    } = await loadFixture(twoPlanFixture);

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
