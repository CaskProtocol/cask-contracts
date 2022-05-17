const { expect } = require("chai");

const {
    usdcUnits,
    daiUnits,
    usdtUnits,
} = require("../utils/units");

const {
    fundedFixture,
} = require("./fixtures/vault");


describe("CaskVault", function () {

    it("Deposit non-base asset funds into vault", async function() {

        const {
            networkAddresses,
            vault,
            consumerA,
        } = await fundedFixture();

        await vault.connect(consumerA).deposit(networkAddresses.DAI, daiUnits('100.0'));
        expect(await vault.currentValueOf(consumerA.address)).to.equal(usdcUnits('100.0'));

    });

    it("Deposit base asset funds into vault", async function() {

        const {
            networkAddresses,
            vault,
            consumerA,
        } = await fundedFixture();

        await vault.connect(consumerA).deposit(networkAddresses.USDC, usdcUnits('100.0'));
        expect(await vault.currentValueOf(consumerA.address)).to.equal(usdcUnits('100.0'));

    });

    it("Min deposit enforced", async function() {

        const {
            networkAddresses,
            vault,
            consumerA,
            governor,
        } = await fundedFixture();

        await vault.connect(governor).setMinDeposit(usdcUnits('0'));

        await vault.connect(consumerA).deposit(networkAddresses.USDC, usdcUnits('0.005'));

        await vault.connect(governor).setMinDeposit(usdcUnits('0.01'));

        await expect(vault.connect(consumerA).deposit(networkAddresses.USDC, usdcUnits('0.005')))
            .to.be.revertedWith("!MIN_DEPOSIT");

        await vault.connect(consumerA).deposit(networkAddresses.USDC, usdcUnits('0.01'));

        await vault.connect(consumerA).deposit(networkAddresses.USDC, usdcUnits('10.01'));

    });

    it("Deposit limit enforced", async function() {

        const {
            networkAddresses,
            vault,
            consumerA,
            governor,
        } = await fundedFixture();

        // set DAI deposit limit to 1000
        await vault.connect(governor).allowAsset(
            networkAddresses.DAI,
            networkAddresses.DAI_USD,
            daiUnits('1000'),
            0);

        await vault.connect(consumerA).deposit(networkAddresses.DAI, daiUnits('990'));

        await expect(vault.connect(consumerA).deposit(networkAddresses.DAI, daiUnits('15')))
            .to.be.revertedWith("!DEPOSIT_LIMIT(asset)");

        // set DAI deposit limit to 2000
        await vault.connect(governor).allowAsset(
            networkAddresses.DAI,
            networkAddresses.DAI_USD,
            daiUnits('2000'),
            0);

        await vault.connect(consumerA).deposit(networkAddresses.DAI, daiUnits('1010'));

    });

    it("Old feed price rejects deposit", async function() {

        const {
            networkAddresses,
            vault,
            consumerA,
            governor,
        } = await fundedFixture();

        // require max age of 30 seconds
        await vault.connect(governor).setMaxPriceFeedAge(ethers.BigNumber.from('30'));

        const daiPriceFeed = await ethers.getContract("MockChainlinkOracleFeedDAI");

        // set dai price age to 5 minutes
        await daiPriceFeed.setAge(ethers.BigNumber.from('300'));

        // confirm deposit rejected
        await expect(vault.connect(consumerA).deposit(networkAddresses.DAI, daiUnits('100')))
            .to.be.revertedWith("!PRICE_FEED_TOO_OLD");

        // set dai price age to 10 seconds
        await daiPriceFeed.setAge(ethers.BigNumber.from('10'));

        // confirm deposit is fine with current price
        await vault.connect(consumerA).deposit(networkAddresses.DAI, daiUnits('100'));

    });

});
