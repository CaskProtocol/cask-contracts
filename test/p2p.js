const { expect } = require("chai");
const { CaskSDK } = require('@caskprotocol/sdk');

const {
    usdcUnits,
    day,
} = require("../utils/units");

const {
    advanceTimeRunP2PKeeper,
} = require("./_helpers");

const {
    fundedFixture,
} = require("./fixtures/vault");


describe("CaskP2P General", function () {

    it("Basic P2P lifecycle", async function () {

        const {
            networkAddresses,
            consumerA,
            consumerB,
            vault,
        } = await fundedFixture();

        const p2p = await ethers.getContract("CaskP2P");

        const consumerAVault = vault.connect(consumerA);
        const consumerAP2P = p2p.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialUserBalance = await consumerAVault.currentValueOf(consumerA.address);
        expect(initialUserBalance).to.equal(usdcUnits('100'));


        let result;

        // create P2P flow
        const tx = await consumerAP2P.createP2P(
            consumerB.address, // to
            usdcUnits('10'), // amount
            0, // totalAmount
            7 * day // period
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "P2PCreated");
        const p2pId = createdEvent.args.p2pId;
        expect(p2pId).to.not.be.undefined;
        expect(createdEvent.args.to).to.equal(consumerB.address);
        expect(createdEvent.args.amount).to.equal(usdcUnits('10'));
        expect(createdEvent.args.period).to.equal(7*day);

        // confirm initial P2P flow was processed
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('90'));
        expect(await consumerAVault.currentValueOf(consumerB.address)).to.equal(usdcUnits('9.50'));

        await advanceTimeRunP2PKeeper(9, day);

        // confirm second P2P flow was processed
        result = await consumerAP2P.getP2P(p2pId);
        expect(result.status).to.equal(CaskSDK.p2pStatus.ACTIVE);
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('80'));
        expect(await consumerAVault.currentValueOf(consumerB.address)).to.equal(usdcUnits('19'));

        await advanceTimeRunP2PKeeper(7, day);

        // confirm third P2P flow was processed
        result = await consumerAP2P.getP2P(p2pId);
        expect(result.status).to.equal(CaskSDK.p2pStatus.ACTIVE);
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('70'));
        expect(await consumerAVault.currentValueOf(consumerB.address)).to.equal(usdcUnits('28.5'));

    });

    it("P2P with totalAmount", async function () {

        const {
            networkAddresses,
            consumerA,
            consumerB,
            vault,
        } = await fundedFixture();

        const p2p = await ethers.getContract("CaskP2P");

        const consumerAVault = vault.connect(consumerA);
        const consumerAP2P = p2p.connect(consumerA);


        // deposit to vault
        await consumerAVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialUserBalance = await consumerAVault.currentValueOf(consumerA.address);
        expect(initialUserBalance).to.equal(usdcUnits('100'));


        let result;

        // create P2P flow
        const tx = await consumerAP2P.createP2P(
            consumerB.address, // to
            usdcUnits('10'), // amount
            usdcUnits('25'), // totalAmount
            7 * day // period
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "P2PCreated");
        const p2pId = createdEvent.args.p2pId;
        expect(p2pId).to.not.be.undefined;
        expect(createdEvent.args.to).to.equal(consumerB.address);
        expect(createdEvent.args.amount).to.equal(usdcUnits('10'));
        expect(createdEvent.args.period).to.equal(7*day);

        // confirm initial P2P flow was processed
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('90'));
        expect(await consumerAVault.currentValueOf(consumerB.address)).to.equal(usdcUnits('9.50'));

        await advanceTimeRunP2PKeeper(9, day);

        // confirm second P2P flow was processed
        result = await consumerAP2P.getP2P(p2pId);
        expect(result.status).to.equal(CaskSDK.p2pStatus.ACTIVE);
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('80'));
        expect(await consumerAVault.currentValueOf(consumerB.address)).to.equal(usdcUnits('19'));

        await advanceTimeRunP2PKeeper(7, day);

        // confirm third P2P flow was processed
        result = await consumerAP2P.getP2P(p2pId);
        expect(result.status).to.equal(CaskSDK.p2pStatus.COMPLETE);
        expect(await consumerAVault.currentValueOf(consumerA.address)).to.equal(usdcUnits('75'));
        expect(await consumerAVault.currentValueOf(consumerB.address)).to.equal(usdcUnits('23.5'));

    });

});
