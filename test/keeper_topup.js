const { expect } = require("chai");

const {
    usdcUnits,
    linkUnits,
    day,
} = require("../utils/units");

const {
    parseUnits
} = require("ethers").utils;

const {
    advanceTimeRunKTUKeeper,
} = require("./_helpers");

const {
    ktuFixture,
} = require("./fixtures/keeper_topup");


describe("CaskKeeperTopup General", function () {

    it("Basic KeeperTopup lifecycle", async function () {

        const {
            networkAddresses,
            user,
            vault,
            keeperRegistry,
            erc677Link,
            ktu,
            ktuManager,
        } = await ktuFixture();

        const userVault = vault.connect(user);
        const userKTU = ktu.connect(user);


        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('1000'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('1000'));

        let result;

        // create keeper topup
        const tx = await userKTU.createKeeperTopup(
            12345, // keeperId
            linkUnits('5'), // lowBalance
            usdcUnits('10') // topupAmount
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "KeeperTopupCreated");
        const ktuId = createdEvent.args.keeperTopupId;
        expect(ktuId).to.not.be.undefined;
        expect(createdEvent.args.user).to.equal(user.address);

        await keeperRegistry.spendFunds(ktuId, linkUnits('2'));
        expect(await erc677Link.balanceOf(user.address)).to.equal(linkUnits('3'));

        await advanceTimeRunKTUKeeper(1, day);

        // expect(await abc.balanceOf(user.address)).to.equal(linkUnits('3'));

    });

});
