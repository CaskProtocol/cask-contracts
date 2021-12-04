const { expect } = require("chai");

const {
  loadFixture,
  usdcUnits,
  daiUnits,
  usdtUnits,
} = require("./_helpers");

const {
  basicFixture,
  basicFundedFixture
} = require("./_fixtures");


describe("CaskSubscriptions", function () {

  it("Contracts are initialized properly", async function () {
    const {vault} = await loadFixture(basicFixture); // fixture performs the create
    expect((await vault.getAllAssets()).length).to.equal(3);
  });

  it("Create a subscription successfully", async function () {

    const {
      consumerA,
      subscriptions,
      subscriptionPlanIds
    } = await loadFixture(basicFixture);

    expect(await subscriptions.getConsumerSubscriptionCount(consumerA.address)).to.equal("0");

    await subscriptions.connect(consumerA).createSubscription(
        subscriptionPlanIds[0], // planId
        ethers.utils.id(""), // discountProof - keccak256 hash of bytes of discount code string
        ethers.utils.formatBytes32String("sub1"), // ref
        0, // cancelAt
        ethers.utils.keccak256("0x"), 0, 0 // metaHash, metaHF, metaSize - IPFS CID of subscription metadata
    );

    expect(await subscriptions.getConsumerSubscriptionCount(consumerA.address)).to.equal("1");

  });

  it("Deposit non-base asset funds into vault", async function() {
    const {
      vault,
      consumerA,
      usdc
    } = await loadFixture(basicFundedFixture);

    await vault.connect(consumerA).deposit(usdc.address, usdcUnits('100.0'));
    expect(await vault.balanceOf(consumerA.address)).to.equal(usdcUnits('100.0'));

  });

  it("Deposit base asset funds into vault", async function() {
    const {
      vault,
      consumerA,
      dai,
    } = await loadFixture(basicFundedFixture);

    await vault.connect(consumerA).deposit(dai.address, daiUnits('100.0'));
    expect(await vault.balanceOf(consumerA.address)).to.equal(daiUnits('100.0'));

  });

});
