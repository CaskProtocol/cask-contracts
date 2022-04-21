const { expect } = require("chai");

const { parseUnits } = require("ethers").utils;
const {
    usdcUnits,
    daiUnits,
    usdtUnits,
} = require("../utils/units");

const {
    vaultFixture,
} = require("./fixtures/vault");


describe("Conversions", function () {

    it("converts properly", async function() {

        const {
            networkAddresses,
            vault,
            governor,
        } = await vaultFixture();

        console.log("1000.0 DAI to USDC converted value:",
            (await vault.convertPrice(networkAddresses.DAI, networkAddresses.USDC, daiUnits("1000.0"))).toString());


    });

});
