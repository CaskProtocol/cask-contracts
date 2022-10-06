const {
    isDevnet,
    isTestnet,
    isInternal,
} = require("../test/_networks");

const {
    deployWithConfirmation,
} = require("../utils/deploy");

const deployKeeperTopupMocks = async ({ethers}) => {

    await deployWithConfirmation("MockERC20LINK");
    await deployWithConfirmation("MockERC677LINK");
    await deployWithConfirmation("MockChainlinkOracleFeedLINK",
        [
            ethers.utils.parseUnits("1", 8).toString(), // price
            8 // decimals
        ],
        "MockChainlinkOracleFeed");
    await deployWithConfirmation("MockKeeperRegistry");
    await deployWithConfirmation("MockPegSwap");
    await deployWithConfirmation("MockUniswapRouterUSDCLINK", null, "MockUniswapRouter");

    const router = await ethers.getContract("MockUniswapRouterUSDCLINK");
    const erc677Link = await ethers.getContract("MockERC677LINK");
    const registry = await ethers.getContract("MockKeeperRegistry");

    await router.initialize();
    await registry.initialize(erc677Link.address);

};


const main = async (hre) => {
    console.log("Running 011_keeper_topup_mocks deployment...");
    await deployKeeperTopupMocks(hre);
    console.log("011_keeper_topup_mocks deploy done.");
    return true;
};

main.id = "011_keeper_topup_mocks";
main.tags = ["keeper_topup_mocks"];
main.skip = () => (!isDevnet && !isTestnet &&!isInternal);

module.exports = main