const { expect } = require("chai");

const {
    usdcUnits,
    linkUnits,
    day,
} = require("../utils/units");

const {
    advanceTimeRunKTUKeeper,
} = require("./_helpers");

const {
    ktuFundedFixture,
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
        } = await ktuFundedFixture();

        const userVault = vault.connect(user);
        const userKTU = ktu.connect(user);
        const userERC77Link = erc677Link.connect(user);

        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('1000'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('1000'));

        let tx;
        let result;

        const upkeepId = 1;
        await keeperRegistry.registerUpkeep(user.address, 5000000, user.address, 0);

        await userERC77Link.transferAndCall(keeperRegistry.address, linkUnits('7.0'),
            ethers.utils.defaultAbiCoder.encode(['uint256'],[upkeepId]));
        result = await keeperRegistry.getUpkeep(upkeepId);
        expect(result.balance).to.equal(linkUnits('7.0')); // confirm ERC677 funding worked

        // create keeper topup
        tx = await userKTU.createKeeperTopup(
            upkeepId, // keeperId
            linkUnits('5'), // lowBalance
            usdcUnits('10') // topupAmount
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "KeeperTopupCreated");
        const ktuId = createdEvent.args.keeperTopupId;
        expect(ktuId).to.not.be.undefined;
        expect(createdEvent.args.user).to.equal(user.address);

        await keeperRegistry.spendFunds(upkeepId, linkUnits('1')); // spend down to 6 LINK
        await advanceTimeRunKTUKeeper(2, day);

        result = await keeperRegistry.getUpkeep(upkeepId);
        expect(result.balance).to.equal(linkUnits('6')); // confirm 1 LINK was spent

        await keeperRegistry.spendFunds(upkeepId, linkUnits('2')); // spend down to 4 LINK
        await advanceTimeRunKTUKeeper(1, day);

        // confirm topup happened
        result = await ktu.getKeeperTopup(ktuId);
        expect(result.numTopups).to.equal(1);
        expect(result.numSkips).to.equal(0);
        result = await keeperRegistry.getUpkeep(upkeepId);
        expect(result.balance).to.equal(linkUnits('23.8')); // == 4 + ((10 - 0.1 fee) / 0.5 LINK price))
        result = await userVault.currentValueOf(user.address);
        expect(result).to.equal(usdcUnits('990')); // == 1000 - 10

        await advanceTimeRunKTUKeeper(5, day);

        result = await keeperRegistry.getUpkeep(upkeepId);
        expect(result.balance).to.equal(linkUnits('23.8'));

        await advanceTimeRunKTUKeeper(5, day);

        result = await keeperRegistry.getUpkeep(upkeepId);
        expect(result.balance).to.equal(linkUnits('23.8'));

        await keeperRegistry.spendFunds(upkeepId, linkUnits('20')); // spend down to 3.8 LINK
        result = await keeperRegistry.getUpkeep(upkeepId);
        expect(result.balance).to.equal(linkUnits('3.8'));

        await advanceTimeRunKTUKeeper(1, day);

        // confirm 2nd topup happened
        result = await ktu.getKeeperTopup(ktuId);
        expect(result.numTopups).to.equal(2);
        expect(result.numSkips).to.equal(0);
        result = await keeperRegistry.getUpkeep(upkeepId);
        expect(result.balance).to.equal(linkUnits('23.6')); // == 3.8 + ((10 - 0.1 fee) / 0.5 LINK price))
        result = await userVault.currentValueOf(user.address);
        expect(result).to.equal(usdcUnits('980')); // == 990 - 10

    });

});
