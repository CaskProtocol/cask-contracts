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

const deployDCAMocks = async ({ethers, getNamedAccounts}) => {

    const {deployerAddr, faucetAdmin} = await hre.getNamedAccounts();
    const deployer = await ethers.provider.getSigner(deployerAddr);

    // Deploy mock coins (assets)
    const mockTokens = [
        "ABC",
    ];
    for (const mockToken of mockTokens) {
        const contract = "Mock"+mockToken;

        await deployWithConfirmation(contract);

        const deployedContract = await ethers.getContract(contract);

        await withConfirmation(
            deployedContract.grantRole(await deployedContract.MINTER_ROLE(), faucetAdmin)
        );
        log(`Granted MINTER_ROLE on ${contract} at ${deployedContract.address} to faucetAdmin ${faucetAdmin}`);

        await deployWithConfirmation("MockChainlinkOracleFeed"+mockToken,
            [
                ethers.utils.parseUnits("1", 8).toString(), // price
                8 // decimals
            ],
            "MockChainlinkOracleFeed");
    }

    await deployWithConfirmation("MockUniswapRouter");

    const router = await ethers.getContract("MockUniswapRouter");

    const usdc = await ethers.getContract("MockUSDC");
    const abc = await ethers.getContract("MockABC");

    await router.initialize();

    // mint swap liquidity to mock router
    await usdc.connect(deployer).mint(router.address, usdcUnits('100000.0'));
    await abc.connect(deployer).mint(router.address, ethers.utils.parseUnits('100000.0', 18));

    log(`Initialized and funded mock router with 100k USDC/ABC at ${router.address}`);

};


const main = async (hre) => {
    console.log("Running 007_dca_mocks deployment...");
    await deployDCAMocks(hre);
    console.log("007_dca_mocks deploy done.");
    return true;
};

main.id = "007_dca_mocks";
main.tags = ["dca_mocks"];
main.skip = () => (!isDevnet && !isTestnet &&!isInternal);

module.exports = main