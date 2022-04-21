const { expect } = require("chai");
const { CaskSDK } = require('@caskprotocol/sdk');

const {
  usdcUnits,
  day,
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
    await consumerAVault.deposit(networkAddresses.USDC, usdcUnits('100'));

    // check initial balance
    const initialConsumerBalance = await consumerAVault.currentValueOf(consumerA.address);
    expect(initialConsumerBalance).to.equal(usdcUnits('100'));

    let result;

    const ref = ethers.utils.id("user1");

    const plan = plans.find((p) => p.planId === 100);
    const plansProof = CaskSDK.utils.generatePlanProof(plan.provider, ref, plan.planData, plansRoot,
        CaskSDK.utils.plansMerkleProof(plans, plan));
    const discountProof = CaskSDK.utils.generateDiscountProof(0, 0, discountsRoot)

    // create subscription
    const tx = await consumerASubscriptions.createSubscription(
        0, // nonce
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
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('100'));

    await advanceTimeRunSubscriptionKeeper(5, day);

    // confirm no charge before 7 day trial ends
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('100'));

    await advanceTimeRunSubscriptionKeeper(3, day);

    // confirm charge after 7 day trial ended
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('90'));
    result = await consumerASubscriptions.getSubscription(subscriptionId);
    expect(result.subscription.discountId).to.equal(ethers.utils.hexZeroPad(0, 32)); // no discount code

    await advanceTimeRunSubscriptionKeeper(31, day);

    // confirm charge after another month
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('80'));
    result = await consumerASubscriptions.getSubscription(subscriptionId);

    await advanceTimeRunSubscriptionKeeper(31, day);

    // confirm charge after another month
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('70'));
    result = await consumerASubscriptions.getSubscription(subscriptionId);

    // cancel
    expect(await consumerASubscriptions.cancelSubscription(subscriptionId, result.subscription.renewAt))
        .to.emit(consumerASubscriptions, "SubscriptionPendingCancel");

    await advanceTimeRunSubscriptionKeeper(32, day);

    // confirm no charges after cancel
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('70'));
    result = await consumerASubscriptions.getSubscription(subscriptionId);

    await advanceTimeRunSubscriptionKeeper(31, day);

    // confirm still no charges after cancel
    expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('70'));
    result = await consumerASubscriptions.getSubscription(subscriptionId);

  });

});
