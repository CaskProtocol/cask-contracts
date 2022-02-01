const hre = require("hardhat");
const addresses = require("../utils/addresses");
const { parseUnits, formatUnits } = require("ethers").utils;

const {
    isRealChain,
    isPolygon,
} = require("./_networks");



// keep in sync with ICaskSubscriptions.sol
const SubscriptionStatus = {
    None: 0,
    Trialing: 1,
    Active: 2,
    Paused: 3,
    Canceled: 4,
    PendingCancel: 5,
    PastDue: 6,
};

// keep in sync with ICaskSubscriptionPlans.sol
const PlanStatus = {
    None: 0,
    Enabled: 1,
    Disabled: 2,
    EndOfLife: 3,
};

const advanceTime = async (seconds) => {
    await hre.ethers.provider.send("evm_increaseTime", [seconds]);
    await hre.ethers.provider.send("evm_mine");
};

const getBlockTimestamp = async () => {
    return (await hre.ethers.provider.getBlock("latest")).timestamp;
};

const advanceBlocks = async (numBlocks) => {
    for (let i = 0; i < numBlocks; i++) {
        await hre.ethers.provider.send("evm_mine");
    }
};


/**
 * Sets the price in USD the mix oracle will return for a specific token.
 * This first sets the ETH price in USD, then token price in ETH
 *
 * @param {string} tokenSymbol: "DAI", USDC", etc...
 * @param {number} usdPrice: price of the token in USD.
 * @returns {Promise<void>}
 */
const setOracleTokenPriceUsd = async (tokenSymbol, usdPrice) => {
    if (isRealChain) {
        throw new Error(
            `setOracleTokenPriceUsd not supported on network ${hre.network.name}`
        );
    }
    // Set the chainlink token price in USD, with 8 decimals.
    const tokenFeed = await ethers.getContract(
        "MockChainlinkOracleFeed" + tokenSymbol
    );
    const decimals = await tokenFeed.decimals();
    await tokenFeed.setPrice(parseUnits(usdPrice, decimals));
};

const getNetworkAddresses = async (deployments) => {
    if (isPolygon) {
        return addresses.polygon;
    } else {
        // On other environments, return mock feeds.
        return {
            DAI_USD: (await deployments.get("MockChainlinkOracleFeedDAI")).address,
            USDC_USD: (await deployments.get("MockChainlinkOracleFeedUSDC")).address,
            USDT_USD: (await deployments.get("MockChainlinkOracleFeedUSDT")).address,
            WETH_USD: (await deployments.get("MockChainlinkOracleFeedWETH")).address,
            USDT: (await deployments.get("MockUSDT")).address,
            USDC: (await deployments.get("MockUSDC")).address,
            DAI: (await deployments.get("MockDAI")).address,
            WETH: (await deployments.get("MockWETH")).address,
        };
    }
};

const subscriptionCheckUpkeep = async(checkData) => {
    const subscriptionManager = await ethers.getContract("CaskSubscriptionManager");
    return subscriptionManager.checkUpkeep(checkData);
};

const subscriptionPerformUpkeep = async(performData) => {
    const subscriptionManager = await ethers.getContract("CaskSubscriptionManager");
    return subscriptionManager.performUpkeep(performData);
};

const runSubscriptionKeeper = async(limit= 10, offset= 0) => {
    const abiCoder = new ethers.utils.AbiCoder();
    const checkData = abiCoder.encode(['uint256','uint256'], [limit, offset]);
    const checkUpkeep = await subscriptionCheckUpkeep(checkData);

    // console.log(`runSubscriptionKeeper checkUpkeep upkeepNeeded: ${checkUpkeep.upkeepNeeded}`);
    // console.log(`runSubscriptionKeeper checkUpkeep performData: ${checkUpkeep.performData}`);

    if (checkUpkeep.upkeepNeeded) {
        return subscriptionPerformUpkeep(checkUpkeep.performData);
    } else {
        return false;
    }
};


const advanceTimeRunSubscriptionKeeper = async (times, seconds, keeperLimit=10) => {
    let result;
    for (let i = 0; i < times; i++) {
        await advanceTime(seconds);
        result = await runSubscriptionKeeper(keeperLimit);
    }
    return result;
}


module.exports = {
    SubscriptionStatus,
    PlanStatus,
    advanceTime,
    getBlockTimestamp,
    setOracleTokenPriceUsd,
    advanceBlocks,
    getNetworkAddresses,
    runSubscriptionKeeper,
    subscriptionCheckUpkeep,
    subscriptionPerformUpkeep,
    advanceTimeRunSubscriptionKeeper,
};
