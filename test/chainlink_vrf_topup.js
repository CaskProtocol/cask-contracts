const { expect } = require("chai");

const {
    usdcUnits,
    linkUnits,
    day, hour,
} = require("../utils/units");

const {
    advanceTimeRunCLTUKeeper,
    ChainlinkTopupType,
} = require("./_helpers");

const {
    cltuFundedFixture,
} = require("./fixtures/chainlink_topup");


describe("CaskChainlinkTopup VRF General", function () {

    it("Basic vrf topup lifecycle", async function () {

        const {
            networkAddresses,
            user,
            vault,
            vrfCoordinator,
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

        const subId = 1;
        await vrfCoordinator.createSubscription();

        await userERC77Link.transferAndCall(vrfCoordinator.address, linkUnits('7.0'),
            ethers.utils.defaultAbiCoder.encode(['uint64'],[subId]));
        result = await vrfCoordinator.getSubscription(subId);
        expect(result.balance).to.equal(linkUnits('7.0')); // confirm ERC677 funding worked

        // create keeper topup
        tx = await userCLTU.createChainlinkTopup(
            linkUnits('5'), // lowBalance
            usdcUnits('10'), // topupAmount
            subId,
            vrfCoordinator.address,
            ChainlinkTopupType.VRF
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "ChainlinkTopupCreated");
        const cltuId = createdEvent.args.chainlinkTopupId;
        expect(cltuId).to.not.be.undefined;
        expect(createdEvent.args.user).to.equal(user.address);

        await vrfCoordinator.spendFunds(subId, linkUnits('1')); // spend down to 6 LINK
        await advanceTimeRunCLTUKeeper(2, day);

        result = await vrfCoordinator.getSubscription(subId);
        expect(result.balance).to.equal(linkUnits('6')); // confirm 1 LINK was spent

        await vrfCoordinator.spendFunds(subId, linkUnits('2')); // spend down to 4 LINK
        await advanceTimeRunCLTUKeeper(1, day);

        // confirm topup happened
        result = await cltu.getChainlinkTopup(cltuId);
        expect(result.numTopups).to.equal(1);
        expect(result.numSkips).to.equal(0);
        result = await vrfCoordinator.getSubscription(subId);
        expect(result.balance).to.equal(linkUnits('23.8')); // == 4 + ((10 - 0.1 fee) / 0.5 LINK price))
        result = await userVault.currentValueOf(user.address);
        expect(result).to.equal(usdcUnits('990')); // == 1000 - 10

        await advanceTimeRunCLTUKeeper(5, day);

        result = await vrfCoordinator.getSubscription(subId);
        expect(result.balance).to.equal(linkUnits('23.8'));

        await advanceTimeRunCLTUKeeper(5, day);

        result = await vrfCoordinator.getSubscription(subId);
        expect(result.balance).to.equal(linkUnits('23.8'));

        await vrfCoordinator.spendFunds(subId, linkUnits('20')); // spend down to 3.8 LINK
        result = await vrfCoordinator.getSubscription(subId);
        expect(result.balance).to.equal(linkUnits('3.8'));

        await advanceTimeRunCLTUKeeper(1, day);

        // confirm 2nd topup happened
        result = await cltu.getChainlinkTopup(cltuId);
        expect(result.numTopups).to.equal(2);
        expect(result.numSkips).to.equal(0);
        result = await vrfCoordinator.getSubscription(subId);
        expect(result.balance).to.equal(linkUnits('23.6')); // == 3.8 + ((10 - 0.1 fee) / 0.5 LINK price))
        result = await userVault.currentValueOf(user.address);
        expect(result).to.equal(usdcUnits('980')); // == 990 - 10

    });


});
