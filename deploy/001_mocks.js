const { parseUnits } = require("ethers").utils;
const { isDevnet } = require("../test/_helpers");

const deployMocks = async ({deployments, getNamedAccounts}) => {
    const {deploy} = deployments;
    const {deployerAddr} = await getNamedAccounts();

    // Deploy mock coins (assets)
    const assetContracts = [
        "MockUSDT",
        "MockUSDC",
        "MockDAI",
        "MockWETH",
    ];
    for (const contract of assetContracts) {
        await deploy(contract, { from: deployerAddr });
    }

    // Deploy mock chainlink oracle price feeds.
    await deploy("MockChainlinkOracleFeedDAI", {
        from: deployerAddr,
        contract: "MockChainlinkOracleFeed",
        args: [parseUnits("1", 8).toString(), 8], // 1 DAI = 1 USD, 8 digits decimal.
    });
    await deploy("MockChainlinkOracleFeedUSDT", {
        from: deployerAddr,
        contract: "MockChainlinkOracleFeed",
        args: [parseUnits("1", 8).toString(), 8], // 1 USDT = 1 USD, 8 digits decimal.
    });
    await deploy("MockChainlinkOracleFeedUSDC", {
        from: deployerAddr,
        contract: "MockChainlinkOracleFeed",
        args: [parseUnits("1", 8).toString(), 8], // 1 USDC = 1 USD, 8 digits decimal.
    });
    await deploy("MockChainlinkOracleFeedWETH", {
        from: deployerAddr,
        contract: "MockChainlinkOracleFeed",
        args: [parseUnits("3333", 8).toString(), 8],
    });

};

const main = async (hre) => {
    console.log("Running 001_mocks deployment...");
    await deployMocks(hre);
    console.log("001_mocks deploy done.");
    return true;
};

main.id = "001_mocks";
main.tags = ["mocks"];
main.skip = () => !isDevnet;

module.exports = main