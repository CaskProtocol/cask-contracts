const { expect } = require("chai");

const {
    usdcUnits,
    linkUnits,
    day, hour,
} = require("../utils/units");

const {
    advanceTimeRunCLTUKeeper,
    ChainlinkTopupType, ChainlinkTopupStatus,
} = require("./_helpers");

const {
    cltuFundedFixture,
} = require("./fixtures/chainlink_topup");


describe("CaskChainlinkTopup Cancel", function () {

    it("Canceled topup is not processed", async function () {

        const {
            networkAddresses,
            user,
            vault,
            automationRegistry,
            erc677Link,
            cltu,
        } = await cltuFundedFixture();

        const userVault = vault.connect(user);
        const userCLTU = cltu.connect(user);
        const userERC77Link = erc677Link.connect(user);

        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('1000'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('1000'));

        let tx;
        let result;

        const upkeepId = 1;
        await automationRegistry.registerUpkeep(user.address, 5000000, user.address, 0);

        await userERC77Link.transferAndCall(automationRegistry.address, linkUnits('7.0'),
            ethers.utils.defaultAbiCoder.encode(['uint256'],[upkeepId]));
        result = await automationRegistry.getUpkeep(upkeepId);
        expect(result.balance).to.equal(linkUnits('7.0')); // confirm ERC677 funding worked

        // create keeper topup
        tx = await userCLTU.createChainlinkTopup(
            linkUnits('5'), // lowBalance
            usdcUnits('10'), // topupAmount
            upkeepId,
            automationRegistry.address,
            ChainlinkTopupType.Automation
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "ChainlinkTopupCreated");
        const cltuId = createdEvent.args.chainlinkTopupId;
        expect(cltuId).to.not.be.undefined;
        expect(createdEvent.args.user).to.equal(user.address);
        result = await cltu.getChainlinkTopup(cltuId);
        const groupId = result.groupId;
        result  = await cltu.getChainlinkTopupGroup(groupId);
        expect(result.chainlinkTopups.length).to.equal(1);

        await automationRegistry.spendFunds(upkeepId, linkUnits('1')); // spend down to 6 LINK
        await advanceTimeRunCLTUKeeper(2, day);

        result = await automationRegistry.getUpkeep(upkeepId);
        expect(result.balance).to.equal(linkUnits('6')); // confirm 1 LINK was spent

        await automationRegistry.spendFunds(upkeepId, linkUnits('2')); // spend down to 4 LINK
        await advanceTimeRunCLTUKeeper(1, day);

        // confirm topup happened
        result = await cltu.getChainlinkTopup(cltuId);
        expect(result.numTopups).to.equal(1);
        expect(result.numSkips).to.equal(0);
        result = await automationRegistry.getUpkeep(upkeepId);
        expect(result.balance).to.equal(linkUnits('23.8')); // == 4 + ((10 - 0.1 fee) / 0.5 LINK price))
        result = await userVault.currentValueOf(user.address);
        expect(result).to.equal(usdcUnits('990')); // == 1000 - 10

        await advanceTimeRunCLTUKeeper(2, day);

        await userCLTU.cancelChainlinkTopup(cltuId); // cancel topup

        result = await cltu.getChainlinkTopup(cltuId);
        expect(result.status).to.equal(ChainlinkTopupStatus.Canceled);
        result  = await cltu.getChainlinkTopupGroup(groupId);
        expect(result.chainlinkTopups.length).to.equal(0);

        await advanceTimeRunCLTUKeeper(2, day);

        result = await automationRegistry.getUpkeep(upkeepId);
        expect(result.balance).to.equal(linkUnits('23.8'));

        await automationRegistry.spendFunds(upkeepId, linkUnits('20')); // spend down to 3.8 LINK
        result = await automationRegistry.getUpkeep(upkeepId);
        expect(result.balance).to.equal(linkUnits('3.8'));

        await advanceTimeRunCLTUKeeper(5, day);

        // confirm no new topup happened
        result = await cltu.getChainlinkTopup(cltuId);
        expect(result.numTopups).to.equal(1);
        result = await userVault.currentValueOf(user.address);
        expect(result).to.equal(usdcUnits('990')); // same as before
        result  = await cltu.getChainlinkTopupGroup(groupId);
        expect(result.chainlinkTopups.length).to.equal(0);

    });

});
