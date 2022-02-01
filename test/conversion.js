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

        await vault.connect(governor).allowAsset(
            networkAddresses.WETH, // address
            networkAddresses.WETH_USD, //priceFeed
            parseUnits('1000000', 18), // depositLimit - 1M WETH
            10, // slippageBps - 0.1%
        );
        console.log("Allowed WETH in vault");

        console.log("1000.0 DAI to USDC converted value:",
            (await vault.convertPrice(networkAddresses.DAI, networkAddresses.USDC, daiUnits("1000.0"))).toString());

        console.log("3.0 WETH to USDC converted value:",
            (await vault.convertPrice(networkAddresses.WETH, networkAddresses.USDC, parseUnits("3.0", 18))).toString());

        console.log("9000 USDC to WETH converted value:",
            (await vault.convertPrice(networkAddresses.USDC, networkAddresses.WETH, usdcUnits("9999.0"))).toString());

    });

});
