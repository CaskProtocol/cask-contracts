const { expect } = require("chai");

const {
    loadFixture,
    usdcUnits,
    daiUnits,
    usdtUnits,
} = require("./_helpers");

const {
    fundedFixture,
} = require("./fixtures/vault");


describe("CaskSubscriptions", function () {

    it("Deposit non-base asset funds into vault", async function() {

        const {
            networkAddresses,
            vault,
            consumerA,
        } = await loadFixture(fundedFixture);

        await vault.connect(consumerA).deposit(networkAddresses.USDC, usdcUnits('100.0'));
        expect(await vault.currentValueOf(consumerA.address)).to.equal(daiUnits('100.0'));

    });

    it("Deposit base asset funds into vault", async function() {

        const {
            networkAddresses,
            vault,
            consumerA,
        } = await loadFixture(fundedFixture);

        await vault.connect(consumerA).deposit(networkAddresses.DAI, daiUnits('100.0'));
        expect(await vault.currentValueOf(consumerA.address)).to.equal(daiUnits('100.0'));

    });

});
