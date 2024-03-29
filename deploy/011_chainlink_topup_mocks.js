const {
    isDevnet,
    isTestnet,
    isInternal,
} = require("../test/_networks");

const {
    deployWithConfirmation, withConfirmation, log,
} = require("../utils/deploy");

const {
    getChainlinkAddresses
} = require("../test/_helpers");

const deployChainlinkTopupMocks = async ({ethers}) => {

    await deployWithConfirmation("MockERC20LINK");
    await deployWithConfirmation("MockERC677LINK");
    await deployWithConfirmation("MockChainlinkOracleFeedLINK",
        [
            ethers.utils.parseUnits("1", 8).toString(), // price
            8 // decimals
        ],
        "MockChainlinkOracleFeed");
    await deployWithConfirmation("MockAutomationRegistry");
    await deployWithConfirmation("MockVRFCoordinator");
    await deployWithConfirmation("MockPegSwap");
    await deployWithConfirmation("MockUniswapRouterUSDCLINK", null, "MockUniswapRouter");

    const router = await ethers.getContract("MockUniswapRouterUSDCLINK");
    const registry = await ethers.getContract("MockAutomationRegistry");

    const chainlinkAddresses = await getChainlinkAddresses(deployments);

    await withConfirmation(
        await router.initialize()
    );
    await withConfirmation(
        await registry.initialize(chainlinkAddresses.ERC677LINK)
    );
    log("Initialized ChainlinkTopup mock router and registry");

};


const main = async (hre) => {
    console.log("Running 011_chainlink_topup_mocks deployment...");
    await deployChainlinkTopupMocks(hre);
    console.log("011_chainlink_topup_mocks deploy done.");
    return true;
};

main.id = "011_chainlink_topup_mocks";
main.tags = ["chainlink_topup_mocks"];
main.skip = () => (!isDevnet && !isTestnet &&!isInternal);

module.exports = main