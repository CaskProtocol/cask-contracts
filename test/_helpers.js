const hre = require("hardhat");
const addresses = require("../utils/addresses");
const { parseUnits } = require("ethers").utils;

const {
    isLocalhost,
    isInternal,
    isMainnet,
} = require("./_networks");



// keep in sync with ICaskSubscriptions.sol
const SubscriptionStatus = {
    None: 0,
    Trialing: 1,
    Active: 2,
    Paused: 3,
    Canceled: 4,
    PastDue: 5,
    PendingPause: 6
};

// keep in sync with ICaskSubscriptionPlans.sol
const PlanStatus = {
    None: 0,
    Enabled: 1,
    Disabled: 2,
    EndOfLife: 3,
};


// keep in sync with ICaskDCA.sol
const DCAStatus = {
    None: 0,
    Active: 1,
    Paused: 2,
    Canceled: 3,
    Complete: 4,
};

// keep in sync with ICaskP2P.sol
const P2PStatus = {
    None: 0,
    Active: 1,
    Paused: 2,
    Canceled: 3,
    Complete: 4,
};


const ChainlinkTopupType = {
    None: 0,
    Automation: 1,
    VRF: 2,
};

const ChainlinkTopupStatus = {
    None: 0,
    Active: 1,
    Paused: 2,
    Canceled: 3,
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

const getChainlinkAddresses = async (deployments) => {
    if (isMainnet) {
        return addresses[hre.network.name];
    } else {
        if (!addresses[hre.network.name]) {
            addresses[hre.network.name] = {};
        }
        return {
            link_swap_router: addresses[hre.network.name].link_swap_router ||
                (await deployments.get("MockUniswapRouterUSDCLINK")).address,
            ERC20LINK: addresses[hre.network.name].ERC20LINK ||
                (await deployments.get("MockERC20LINK")).address,
            ERC677LINK: addresses[hre.network.name].ERC677LINK ||
                (await deployments.get("MockERC677LINK")).address,
            LINK_USD: addresses[hre.network.name].LINK_USD ||
                (await deployments.get("MockChainlinkOracleFeedLINK")).address,
            link_swap_path: addresses[hre.network.name].link_swap_path ||
                [
                    (await deployments.get("MockUSDC")).address,
                    addresses[hre.network.name].ERC677LINK ||
                        (await deployments.get("MockERC677LINK")).address
                ],
            // link_peg_swap: addresses[hre.network.name].link_peg_swap ||
            //     (await deployments.get("MockPegSwap")).address,
            link_peg_swap: addresses.zero,
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
    const results = [];
    results.push(runSubscriptionKeeperType(1, limit, minDepth)); // active
    results.push(runSubscriptionKeeperType(2, limit, minDepth)); // past due
    return results;
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
    for (let i = 0; i < times; i++) {
        await advanceTime(seconds);
        await Promise.all(runSubscriptionKeeper(keeperLimit));
    }
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
    return runDCAKeeperType(1, limit, minDepth);
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
    for (let i = 0; i < times; i++) {
        await advanceTime(seconds);
        await runDCAKeeper(keeperLimit);
    }
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
    return runP2PKeeperType(1, limit, minDepth);
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
    for (let i = 0; i < times; i++) {
        await advanceTime(seconds);
        await runP2PKeeper(keeperLimit);
    }
}

const cltuCheckUpkeep = async(checkData) => {
    const cltuManager = await ethers.getContract("CaskChainlinkTopupManager");
    return cltuManager.checkUpkeep(checkData);
};

const cltuPerformUpkeep = async(performData) => {
    const cltuManager = await ethers.getContract("CaskChainlinkTopupManager");
    return cltuManager.performUpkeep(performData);
};

const runCLTUKeeper = async(limit= 10, minDepth = 0) => {
    return runCLTUKeeperType(1, limit, minDepth);
};

const runCLTUKeeperType = async(queueId, limit= 10, minDepth = 0) => {
    const checkData = ethers.utils.defaultAbiCoder.encode(
        ['uint256','uint256','uint8'],
        [limit, minDepth, queueId]);
    const checkUpkeep = await cltuCheckUpkeep(checkData);

    if (checkUpkeep.upkeepNeeded) {
        return cltuPerformUpkeep(checkUpkeep.performData);
    } else {
        return false;
    }
}

const advanceTimeRunCLTUKeeper = async (times, seconds, keeperLimit=10) => {
    for (let i = 0; i < times; i++) {
        await advanceTime(seconds);
        await runCLTUKeeper(keeperLimit);
    }
}


module.exports = {

    // constants from solidity interfaces
    SubscriptionStatus,
    PlanStatus,
    DCAStatus,
    P2PStatus,
    ChainlinkTopupType,
    ChainlinkTopupStatus,

    advanceTime,
    getBlockTimestamp,
    setOracleTokenPriceUsd,
    advanceBlocks,
    impersonateAccount,
    getNetworkAddresses,
    getChainlinkAddresses,

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

    // Keeper topup keeper
    runCLTUKeeper,
    cltuCheckUpkeep,
    cltuPerformUpkeep,
    advanceTimeRunCLTUKeeper,
};
