const { expect } = require("chai");
const cask = require('@caskprotocol/sdk');

const {
  daiUnits,
  day,
  month,
} = require("../utils/units");

const {
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
      plans,
      plansRoot,
      discountsRoot,
      signedRoots,
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

    let result;

    const ref = ethers.utils.id("user1");

    const plan = plans.find((p) => p.planId === 100);
    const plansProof = cask.utils.generatePlanProof(plan.provider, ref, plan.planData, plansRoot,
        cask.utils.plansMerkleProof(plans, plan));
    const discountProof = cask.utils.generateDiscountProof(0, 0, discountsRoot)

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
    expect(createdEvent.args.provider).to.equal(plan.provider);
    expect(createdEvent.args.planId).to.equal(plan.planId);

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
    result = await consumerASubscriptions.getSubscription(subscriptionId);
    expect(result.subscription.discountId).to.equal(ethers.utils.hexZeroPad(0, 32)); // no discount code

    expect(await advanceTimeRunSubscriptionKeeper(1, month))
        .to.emit(consumerASubscriptions, "SubscriptionRenewed");

    // confirm charge after another month
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('80'));
    result = await consumerASubscriptions.getSubscription(subscriptionId);

    expect(await advanceTimeRunSubscriptionKeeper(1, month))
        .to.emit(consumerASubscriptions, "SubscriptionRenewed");

    // confirm charge after another month
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('70'));
    result = await consumerASubscriptions.getSubscription(subscriptionId);

    // cancel
    expect(await consumerASubscriptions.cancelSubscription(subscriptionId))
        .to.emit(consumerASubscriptions, "SubscriptionPendingCancel");

    expect(await advanceTimeRunSubscriptionKeeper(1, month + day))
        .to.emit(consumerASubscriptions, "SubscriptionCanceled");

    // confirm no charges after cancel
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('70'));
    result = await consumerASubscriptions.getSubscription(subscriptionId);

    await advanceTimeRunSubscriptionKeeper(1, month);

    // confirm still no charges after cancel
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(daiUnits('70'));
    result = await consumerASubscriptions.getSubscription(subscriptionId);

  });

});
