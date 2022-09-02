const {
    isDevnet,
    isTestnet,
    isInternal,
} = require("../test/_networks");

const {
    deployWithConfirmation,
    withConfirmation,
    log
} = require("../utils/deploy");

const {
    usdcUnits
} = require("../utils/units");

const deployKeeperTopupMocks = async ({ethers, getNamedAccounts}) => {

    const {deployerAddr, faucetAdmin} = await hre.getNamedAccounts();
    const deployer = await ethers.provider.getSigner(deployerAddr);

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

    const usdc = await ethers.getContract("MockUSDC");
    const erc677Link = await ethers.getContract("MockERC677LINK");

    await router.initialize([usdc.address], [erc677Link.address]);

    // mint swap liquidity to mock router
    await usdc.connect(deployer).mint(router.address, usdcUnits('100000.0'));
    await erc677Link.connect(deployer).mint(router.address, ethers.utils.parseUnits('100000.0', 18));

    log(`Initialized and funded mock keeper topup router with 100k USDC/ERC677LINK at ${router.address}`);

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