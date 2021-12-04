const { expect } = require("chai");

const { parseUnits } = require("ethers").utils;
const {
    loadFixture,
    usdcUnits,
    daiUnits,
    usdtUnits,
    getNetworkAddresses,
} = require("./_helpers");

const {
    defaultFixture,
} = require("./_fixtures");


describe("Conversions", function () {

    it("converts properly", async function() {

        const {
            vault,
            governor,
            dai,
            usdt,
            usdc,
            weth,
        } = await loadFixture(defaultFixture);

        const networkAddresses = await getNetworkAddresses(deployments);

        await vault.connect(governor).allowAsset(
            networkAddresses.WETH, // address
            networkAddresses.WETH_USD, //priceFeed
            parseUnits('1000000', 18), // depositLimit - 1M WETH
            10, // slippageBps - 0.1%
        );
        console.log("Allowed WETH in vault");

        console.log("1000.0 DAI to USDC converted value:",
            (await vault.convertPrice(dai.address, usdc.address, daiUnits("1000.0"))).toString());

        console.log("3.0 WETH to USDC converted value:",
            (await vault.convertPrice(weth.address, usdc.address, parseUnits("3.0", 18))).toString());

        console.log("9000 USDC to WETH converted value:",
            (await vault.convertPrice(usdc.address, weth.address, usdcUnits("9999.0"))).toString());

    });

});
