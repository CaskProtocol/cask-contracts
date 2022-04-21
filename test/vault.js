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

});
