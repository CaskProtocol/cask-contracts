const { expect } = require("chai");

const {
    usdcUnits,
    linkUnits,
    day, hour,
} = require("../utils/units");

const {
    advanceTimeRunKTUKeeper,
    ChainlinkTopupType,
} = require("./_helpers");

const {
    ktuFundedFixture,
    ktuExcessSlippageFixture,
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
            linkUnits('5'), // lowBalance
            usdcUnits('10'), // topupAmount
            upkeepId, // keeperId
            keeperRegistry.address,
            ChainlinkTopupType.Automation
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

    it("Payment failed", async function () {

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
        await userVault.deposit(networkAddresses.USDC, usdcUnits('5'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('5'));

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
            linkUnits('5'), // lowBalance
            usdcUnits('10'), // topupAmount
            upkeepId, // keeperId
            keeperRegistry.address,
            ChainlinkTopupType.Automation
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

        // confirm topup was skipped
        result = await ktu.getKeeperTopup(ktuId);
        expect(result.numSkips).to.equal(1);
        result = await userVault.currentValueOf(user.address);
        expect(result).to.equal(usdcUnits('5')); // not charged

        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        await advanceTimeRunKTUKeeper(1, day);

        // confirm topup was processed
        result = await ktu.getKeeperTopup(ktuId);
        expect(result.numSkips).to.equal(1);
        expect(result.numTopups).to.equal(1);
        result = await userVault.currentValueOf(user.address);
        expect(result).to.equal(usdcUnits('95')); // 5 + 100 - 10

    });

    it("KeeperTopup handles excess slippage", async function () {

        const {
            networkAddresses,
            user,
            governor,
            vault,
            keeperRegistry,
            erc677Link,
            ktuManager,
            ktu,
        } = await ktuExcessSlippageFixture();

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
            linkUnits('5'), // lowBalance
            usdcUnits('10'), // topupAmount
            upkeepId, // keeperId
            keeperRegistry.address,
            ChainlinkTopupType.Automation
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

        // confirm topup was skipped
        result = await ktu.getKeeperTopup(ktuId);
        expect(result.numSkips).to.equal(1);
        result = await userVault.currentValueOf(user.address);
        expect(result).to.equal(usdcUnits('1000')); // not charged

        // change slippage to 10% max
        await ktuManager.connect(governor).setParameters(
            5, // maxSkips
            60, // topupFeeBps (0.6%)
            usdcUnits('0.1'), // topupFeeMin
            86400+3600, // maxPriceFeedAge (1 day + 1 hour)
            1, // maxTopupsPerRun
            1000, // maxSwapSlippageBps - set to 10%
            24 * hour, // queueBucketSize
            20 * day // maxQueueAge
        );

        await advanceTimeRunKTUKeeper(1, day);

        // confirm topup happened
        result = await ktu.getKeeperTopup(ktuId);
        expect(result.numTopups).to.equal(1);
        expect(result.numSkips).to.equal(1);
        result = await keeperRegistry.getUpkeep(upkeepId);
        expect(result.balance).to.equal(linkUnits('22.81')); // == 4 + ( ((10 - 0.1 fee) / 0.5 LINK price) - 5% slippage ))
        result = await userVault.currentValueOf(user.address);
        expect(result).to.equal(usdcUnits('990')); // == 1000 - 10

    });

    it("KeeperTopup multiple groups", async function () {

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

        // create 10 upkeeps & topups for group 1
        for (let i = 1; i <= 10; i++) {
            await keeperRegistry.registerUpkeep(user.address, 5000000, user.address, 0);

            await userERC77Link.transferAndCall(keeperRegistry.address, linkUnits('6.0'),
                ethers.utils.defaultAbiCoder.encode(['uint256'],[i]));

            await userKTU.createKeeperTopup(
                linkUnits('5'), // lowBalance
                usdcUnits('10'), // topupAmount
                i, // keeperId
                keeperRegistry.address,
                ChainlinkTopupType.Automation
            );
        }

        const upkeepId = 11;
        await keeperRegistry.registerUpkeep(user.address, 5000000, user.address, 0);

        await userERC77Link.transferAndCall(keeperRegistry.address, linkUnits('7.0'),
            ethers.utils.defaultAbiCoder.encode(['uint256'],[upkeepId]));
        result = await keeperRegistry.getUpkeep(upkeepId);
        expect(result.balance).to.equal(linkUnits('7.0')); // confirm ERC677 funding worked

        tx = await userKTU.createKeeperTopup(
            linkUnits('5'), // lowBalance
            usdcUnits('10'), // topupAmount
            upkeepId, // keeperId
            keeperRegistry.address,
            ChainlinkTopupType.Automation
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "KeeperTopupCreated");
        const ktuId = createdEvent.args.keeperTopupId;
        expect(ktuId).to.not.be.undefined;
        expect(createdEvent.args.user).to.equal(user.address);

        result = await ktu.getKeeperTopup(ktuId);
        expect(result.groupId).to.equal(2); // expect group 2 since group size is 10

        await keeperRegistry.spendFunds(upkeepId, linkUnits('3')); // spend down to 4 LINK
        await advanceTimeRunKTUKeeper(10, day);

        // confirm topup was processed
        result = await ktu.getKeeperTopup(ktuId);
        expect(result.numSkips).to.equal(0);
        expect(result.numTopups).to.equal(1);
        result = await keeperRegistry.getUpkeep(upkeepId);
        expect(result.balance).to.equal(linkUnits('23.8')); // == 4 + ((10 - 0.1 fee) / 0.5 LINK price))
        result = await userVault.currentValueOf(user.address);
        expect(result).to.equal(usdcUnits('990')); // charged
    });

});
