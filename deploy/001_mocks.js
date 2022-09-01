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

const deployMocks = async ({ethers, getNamedAccounts}) => {
    const {faucetAdmin} = await getNamedAccounts();

    // Deploy mock coins (assets)
    const mockTokens = [
        "USDT",
        "USDC",
        "DAI",
        "FRAX",
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

    await deployWithConfirmation("MockBandOracleFeed", [ethers.utils.parseUnits("1", 18)]);
};

const deployMockDiscountTokens = async () => {

    // Deploy mock contracts for token based discounts
    const mockTokens = [
        "ERC20",
        "NFT",
    ];
    for (const mockToken of mockTokens) {
        const contract = "Mock"+mockToken;

        await deployWithConfirmation(contract);
    }
};

const main = async (hre) => {
    console.log("Running 001_mocks deployment...");
    await deployMocks(hre);
    await deployMockDiscountTokens(hre);
    console.log("001_mocks deploy done.");
    return true;
};

main.id = "001_mocks";
main.tags = ["mocks"];
main.skip = () => (!isDevnet && !isTestnet &&!isInternal);

module.exports = main