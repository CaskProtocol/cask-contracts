const { expect } = require("chai");
const { CaskSDK } = require('@caskprotocol/sdk');

const {
    usdcUnits,
    day,
} = require("../utils/units");

const {
    advanceTimeRunSubscriptionKeeper,
} = require("./_helpers");

const {
    onePlanWithDiscountsFixture,
    onePlanWithNFTDiscountFixture,
    onePlanWithERC20DiscountFixture,
} = require("./fixtures/subscriptions");


describe("CaskSubscriptions Discount", function () {

    it("Subscription with discount works", async function () {

        const {
            networkAddresses,
            consumerA,
            vault,
            subscriptions,
            plans,
            discounts,
            plansRoot,
            discountsRoot,
            signedRoots,
        } = await onePlanWithDiscountsFixture();

        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialConsumerBalance = await consumerAVault.currentValueOf(consumerA.address);
        expect(initialConsumerBalance).to.equal(usdcUnits('100'));

        let result;

        const ref = ethers.utils.id("user1");

        const plan = plans.find((p) => p.planId === 501);
        const plansProof = CaskSDK.utils.generatePlanProof(plan.provider, ref, plan.planData, plansRoot,
            CaskSDK.utils.plansMerkleProof(plans, plan));

        const discountCodeValidator = CaskSDK.utils.generateDiscountCodeValidator("discount1");
        const discount = CaskSDK.utils.lookupCodeDiscount(discountCodeValidator, discounts);
        let discountProof = [];
        if (discount) {
            discountProof = CaskSDK.utils.generateDiscountProof(discountCodeValidator, discount.discountData, discountsRoot,
                CaskSDK.utils.discountsMerkleProof(discounts, discount));
        } else {
            discountProof = CaskSDK.utils.generateDiscountProof(0, 0, discountsRoot)
        }

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

        await advanceTimeRunSubscriptionKeeper(8, day); // past trial

        // confirm discounted charge after 7 day trial ended - 50% off 10/month == 5; 100 - 5 == 95
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('95'));
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.discountId).to.not.equal(ethers.utils.hexZeroPad(0, 32));

    });

    it("Subscription with NFT discount works", async function () {

        const {
            deployer,
            networkAddresses,
            consumerA,
            consumerB,
            vault,
            subscriptions,
            plans,
            discounts,
            nft,
            plansRoot,
            discountsRoot,
            signedRoots,
        } = await onePlanWithNFTDiscountFixture();

        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialConsumerBalance = await consumerAVault.currentValueOf(consumerA.address);
        expect(initialConsumerBalance).to.equal(usdcUnits('100'));

        let result;

        const ref = ethers.utils.id("user1");

        const plan = plans.find((p) => p.planId === 601);
        const plansProof = CaskSDK.utils.generatePlanProof(plan.provider, ref, plan.planData, plansRoot,
            CaskSDK.utils.plansMerkleProof(plans, plan));


        // mint NFT to consumer
        await nft.connect(deployer).mint(consumerA.address);

        const discount = discounts.find((d) => d.token === nft.address);

        let discountProof = [];
        if (discount) {
            discountProof = CaskSDK.utils.generateDiscountProof(discount.discountId, discount.discountData, discountsRoot,
                CaskSDK.utils.discountsMerkleProof(discounts, discount));
        } else {
            discountProof = CaskSDK.utils.generateDiscountProof(0, 0, discountsRoot)
        }

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

        await advanceTimeRunSubscriptionKeeper(8, day); // past trial

        // confirm discounted charge after 7 day trial ended - 50% off 10/month == 5; 100 - 5 == 95
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('95'));
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.discountId).to.not.equal(ethers.utils.hexZeroPad(0, 32));

        await advanceTimeRunSubscriptionKeeper(31, day);

        // ensure discount still applied at renewal
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('90'));

        // send NFT away
        await nft.connect(consumerA).transferFrom(consumerA.address, consumerB.address, 0);

        await advanceTimeRunSubscriptionKeeper(31, day);

        // ensure full price (10) (no discount) was charged at renewal
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('80'));

    });

    it("Subscription with ERC20 discount works", async function () {

        const {
            deployer,
            networkAddresses,
            consumerA,
            consumerB,
            vault,
            subscriptions,
            plans,
            discounts,
            erc20,
            plansRoot,
            discountsRoot,
            signedRoots,
        } = await onePlanWithERC20DiscountFixture();

        const consumerAVault = vault.connect(consumerA);
        const consumerASubscriptions = subscriptions.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialConsumerBalance = await consumerAVault.currentValueOf(consumerA.address);
        expect(initialConsumerBalance).to.equal(usdcUnits('100'));

        let result;

        const ref = ethers.utils.id("user1");

        const plan = plans.find((p) => p.planId === 701);
        const plansProof = CaskSDK.utils.generatePlanProof(plan.provider, ref, plan.planData, plansRoot,
            CaskSDK.utils.plansMerkleProof(plans, plan));


        // mint ERC20 tokens to consumer
        await erc20.connect(deployer).mint(consumerA.address, ethers.utils.parseUnits('1000', 18));

        const discount = discounts.find((d) => d.token === erc20.address);

        let discountProof = [];
        if (discount) {
            discountProof = CaskSDK.utils.generateDiscountProof(discount.discountId, discount.discountData, discountsRoot,
                CaskSDK.utils.discountsMerkleProof(discounts, discount));
        } else {
            discountProof = CaskSDK.utils.generateDiscountProof(0, 0, discountsRoot)
        }

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

        await advanceTimeRunSubscriptionKeeper(8, day); // past trial

        // confirm discounted charge after 7 day trial ended - 50% off 10/month == 5; 100 - 5 == 95
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('95'));
        result = await consumerASubscriptions.getSubscription(subscriptionId);
        expect(result.subscription.discountId).to.not.equal(ethers.utils.hexZeroPad(0, 32));

        await advanceTimeRunSubscriptionKeeper(31, day);

        // ensure discount still applied at renewal
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('90'));

        // send some tokens away
        await erc20.connect(consumerA).transfer(consumerB.address, ethers.utils.parseUnits('300', 18));

        await advanceTimeRunSubscriptionKeeper(31, day);

        // ensure discount still applied at renewal
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('85'));

        // send enough tokens away to no longer qualify for the discount
        await erc20.connect(consumerA).transfer(consumerB.address, ethers.utils.parseUnits('300', 18));

        await advanceTimeRunSubscriptionKeeper(31, day);

        // ensure full price (10) (no discount) was charged at renewal
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('75'));

    });
});
