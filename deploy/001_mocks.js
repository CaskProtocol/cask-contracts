const { parseUnits } = require("ethers").utils;

const {
    isDevnet,
    isTestnet
} = require("../test/_networks");

const {
    deployWithConfirmation,
    withConfirmation,
    log
} = require("../utils/deploy");

const deployMocks = async ({getNamedAccounts}) => {
    const {faucetAdmin} = await getNamedAccounts();

    // Deploy mock coins (assets)
    const assetContracts = [
        "MockUSDT",
        "MockUSDC",
        "MockDAI",
        "MockWETH",
    ];
    for (const contract of assetContracts) {
        await deployWithConfirmation(contract);

        const deployedContract = await ethers.getContract(contract);

        await withConfirmation(
            deployedContract.grantRole(await deployedContract.MINTER_ROLE(), faucetAdmin)
        );
        log(`Granted MINTER_ROLE on ${contract} at ${deployedContract.address} to faucetAdmin ${faucetAdmin}`);
    }

    await deployWithConfirmation("MockChainlinkOracleFeedDAI",
        [parseUnits("1", 8).toString(), 8],
        "MockChainlinkOracleFeed");

    await  deployWithConfirmation("MockChainlinkOracleFeedUSDT",
        [parseUnits("1", 8).toString(), 8],
        "MockChainlinkOracleFeed");

    await deployWithConfirmation("MockChainlinkOracleFeedUSDC",
        [parseUnits("1", 8).toString(), 8],
        "MockChainlinkOracleFeed");

    await deployWithConfirmation("MockChainlinkOracleFeedWETH",
        [parseUnits("3000", 8).toString(), 8],
        "MockChainlinkOracleFeed");

};

const main = async (hre) => {
    console.log("Running 001_mocks deployment...");
    await deployMocks(hre);
    console.log("001_mocks deploy done.");
    return true;
};

main.id = "001_mocks";
main.tags = ["mocks"];
main.skip = () => (!isDevnet && !isTestnet);

module.exports = main