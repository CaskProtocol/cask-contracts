const hre = require("hardhat");
const addresses = require("../utils/addresses");
const { parseUnits } = require("ethers").utils;

const {
    isLocalhost,
    isInternal,
    isMainnet,
} = require("./_networks");

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

const impersonateAccount = async (account) => {
    return hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [account],
    });
};


/**
 * Sets the price in USD the mock oracle will return for a specific token.
 *
 * @param {string} tokenSymbol: "DAI", USDC", etc...
 * @param {number} usdPrice: price of the token in USD.
 * @returns {Promise<void>}
 */
const setOracleTokenPriceUsd = async (tokenSymbol, usdPrice) => {
    if (!isLocalhost && !isInternal) {
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
    if (isMainnet) {
        return addresses[hre.network.name];
    } else {
        if (!addresses[hre.network.name]) {
            addresses[hre.network.name] = {};
        }
        return {
            DAI: addresses[hre.network.name].DAI ||
                (await deployments.get("MockDAI")).address,
            USDC: addresses[hre.network.name].USDC ||
                (await deployments.get("MockUSDC")).address,
            USDT: addresses[hre.network.name].USDT ||
                (await deployments.get("MockUSDT")).address,
            FRAX: addresses[hre.network.name].FRAX ||
                (await deployments.get("MockFRAX")).address,

            DAI_USD: addresses[hre.network.name].DAI_USD ||
                (await deployments.get("MockChainlinkOracleFeedDAI")).address,
            USDC_USD: addresses[hre.network.name].USDC_USD ||
                (await deployments.get("MockChainlinkOracleFeedUSDC")).address,
            USDT_USD: addresses[hre.network.name].USDT_USD ||
                (await deployments.get("MockChainlinkOracleFeedUSDT")).address,
            FRAX_USD: addresses[hre.network.name].FRAX_USD ||
                (await deployments.get("MockChainlinkOracleFeedFRAX")).address,
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

const runSubscriptionKeeper = async(limit= 10, minDepth = 0) => {
    await runSubscriptionKeeperType(1, limit, minDepth); // active
    await runSubscriptionKeeperType(2, limit, minDepth); // past due
};

const runSubscriptionKeeperType = async(checkType, limit= 10, minDepth = 0) => {
    const checkData = ethers.utils.defaultAbiCoder.encode(
        ['uint256','uint256','uint8'],
        [limit, minDepth, checkType]);
    const checkUpkeep = await subscriptionCheckUpkeep(checkData);

    if (checkUpkeep.upkeepNeeded) {
        return subscriptionPerformUpkeep(checkUpkeep.performData);
    } else {
        return false;
    }
}

const advanceTimeRunSubscriptionKeeper = async (times, seconds, keeperLimit=10) => {
    let result;
    for (let i = 0; i < times; i++) {
        await advanceTime(seconds);
        result = await runSubscriptionKeeper(keeperLimit);
    }
    return result;
}

const dcaCheckUpkeep = async(checkData) => {
    const dcaManager = await ethers.getContract("CaskDCAManager");
    return dcaManager.checkUpkeep(checkData);
};

const dcaPerformUpkeep = async(performData) => {
    const dcaManager = await ethers.getContract("CaskDCAManager");
    return dcaManager.performUpkeep(performData);
};

const runDCAKeeper = async(limit= 10, minDepth = 0) => {
    await runDCAKeeperType(1, limit, minDepth);
};

const runDCAKeeperType = async(queueId, limit= 10, minDepth = 0) => {
    const checkData = ethers.utils.defaultAbiCoder.encode(
        ['uint256','uint256','uint8'],
        [limit, minDepth, queueId]);
    const checkUpkeep = await dcaCheckUpkeep(checkData);

    if (checkUpkeep.upkeepNeeded) {
        return dcaPerformUpkeep(checkUpkeep.performData);
    } else {
        return false;
    }
}

const advanceTimeRunDCAKeeper = async (times, seconds, keeperLimit=10) => {
    let result;
    for (let i = 0; i < times; i++) {
        await advanceTime(seconds);
        result = await runDCAKeeper(keeperLimit);
    }
    return result;
}

const p2pCheckUpkeep = async(checkData) => {
    const p2pManager = await ethers.getContract("CaskP2PManager");
    return p2pManager.checkUpkeep(checkData);
};

const p2pPerformUpkeep = async(performData) => {
    const p2pManager = await ethers.getContract("CaskP2PManager");
    return p2pManager.performUpkeep(performData);
};

const runP2PKeeper = async(limit= 10, minDepth = 0) => {
    await runP2PKeeperType(1, limit, minDepth);
};

const runP2PKeeperType = async(queueId, limit= 10, minDepth = 0) => {
    const checkData = ethers.utils.defaultAbiCoder.encode(
        ['uint256','uint256','uint8'],
        [limit, minDepth, queueId]);
    const checkUpkeep = await p2pCheckUpkeep(checkData);

    if (checkUpkeep.upkeepNeeded) {
        return p2pPerformUpkeep(checkUpkeep.performData);
    } else {
        return false;
    }
}

const advanceTimeRunP2PKeeper = async (times, seconds, keeperLimit=10) => {
    let result;
    for (let i = 0; i < times; i++) {
        await advanceTime(seconds);
        result = await runP2PKeeper(keeperLimit);
    }
    return result;
}


module.exports = {

    advanceTime,
    getBlockTimestamp,
    setOracleTokenPriceUsd,
    advanceBlocks,
    impersonateAccount,
    getNetworkAddresses,

    // subscriptions keeper
    runSubscriptionKeeper,
    subscriptionCheckUpkeep,
    subscriptionPerformUpkeep,
    advanceTimeRunSubscriptionKeeper,

    // DCA keeper
    runDCAKeeper,
    dcaCheckUpkeep,
    dcaPerformUpkeep,
    advanceTimeRunDCAKeeper,

    // P2P keeper
    runP2PKeeper,
    p2pCheckUpkeep,
    p2pPerformUpkeep,
    advanceTimeRunP2PKeeper,
};
