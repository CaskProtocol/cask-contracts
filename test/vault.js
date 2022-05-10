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

});
