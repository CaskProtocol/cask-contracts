const { expect } = require("chai");

const {
    usdcUnits,
    day,
} = require("../utils/units");

const {
    parseUnits
} = require("ethers").utils;

const {
    advanceTimeRunDCAKeeper,
    DCAStatus,
} = require("./_helpers");

const {
    ktuFixture,
} = require("./fixtures/keeper_topup");


describe("CaskDCA General", function () {

    it("Basic KeeperTopup lifecycle", async function () {

        const {
            networkAddresses,
            user,
            vault,
            ktu,
        } = await ktuFixture();

        const userVault = vault.connect(user);
        const userKTU = ktu.connect(user);


        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('1000'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('1000'));

        let result;

        // create DCA
        const tx = await userKTU.createKeeperTopup(
            12345, // keeperId
            ethers.utils.parseUnits('10', 18), // lowBalance
            usdcUnits(10) // topupAmount
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "DCACreated");
        const dcaId = createdEvent.args.dcaId;
        expect(dcaId).to.not.be.undefined;
        expect(createdEvent.args.user).to.equal(user.address);
        expect(createdEvent.args.to).to.equal(user.address);
        expect(createdEvent.args.amount).to.equal(usdcUnits('100'));
        expect(createdEvent.args.period).to.equal(7*day);

        // confirm initial DCA was processed
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('900'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('99.70', 18));

        await advanceTimeRunDCAKeeper(9, day);

        // confirm second DCA was processed
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(DCAStatus.Active);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('800'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('199.40', 18));

        await advanceTimeRunDCAKeeper(7, day);

        // confirm third DCA was processed
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(DCAStatus.Active);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('700'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('299.10', 18));

    });

});
