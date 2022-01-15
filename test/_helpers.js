const hre = require("hardhat");
const { parseUnits, formatUnits } = require("ethers").utils;
const { createFixtureLoader } = require("ethereum-waffle");

const addresses = require("../utils/addresses");

function caskUnits(amount) {
    return parseUnits(amount, 18);
}

function caskUnitsFormat(amount) {
    return formatUnits(amount, 18);
}

function usdtUnits(amount) {
    return parseUnits(amount, 6);
}

function usdtUnitsFormat(amount) {
    return formatUnits(amount, 6);
}

function usdcUnits(amount) {
    return parseUnits(amount, 6);
}

function usdcUnitsFormat(amount) {
    return formatUnits(amount, 6);
}

function daiUnits(amount) {
    return parseUnits(amount, 18);
}

function daiUnitsFormat(amount) {
    return formatUnits(amount, 18);
}

const now = Math.floor(Date.now() / 1000);
const hour = 3600;
const day = 24 * hour;
const month = (365/12) * day;
const year = month * 12;

const isFork = process.env.FORK === "true";
const isLocalhost = !isFork && hre.network.name === "localhost";
const isMemnet = hre.network.name === "hardhat";

const isKovan = hre.network.name === "kovan";
const isMainnet = hre.network.name === "mainnet";

const isPolygon = hre.network.name === "polygon";
const isMumbai = hre.network.name === "mumbai";

const isTest = process.env.IS_TEST === "true";

const isDevnet = isLocalhost || isMemnet;
const isTestnet = isKovan || isMumbai;
const isProdnet = isMainnet || isPolygon;
const isRealChain = !isLocalhost && !isMemnet;
const isDaoChain = isMemnet || isFork || isLocalhost || isMainnet || isKovan;
const isProtocolChain = isMemnet || isFork || isLocalhost || isPolygon || isMumbai;

// Fixture loader that is compatible with Ganache
const loadFixture = createFixtureLoader(
    [
        hre.ethers.provider.getSigner(0),
        hre.ethers.provider.getSigner(1),
        hre.ethers.provider.getSigner(2),
        hre.ethers.provider.getSigner(3),
        hre.ethers.provider.getSigner(4),
        hre.ethers.provider.getSigner(5),
        hre.ethers.provider.getSigner(6),
        hre.ethers.provider.getSigner(7),
        hre.ethers.provider.getSigner(8),
        hre.ethers.provider.getSigner(9),
    ],
    hre.ethers.provider
);

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
    } else if (isMumbai) {
        return {
            DAI_USD: addresses.mumbai.DAI_USD,
            USDC_USD: addresses.mumbai.USDC_USD,
            USDT_USD: addresses.mumbai.USDT_USD,
            WETH_USD: addresses.mumbai.WETH_USD,
            USDT: (await deployments.get("FakeUSDT")).address,
            USDC: (await deployments.get("FakeUSDC")).address,
            DAI: (await deployments.get("FakeDAI")).address,
            WETH: (await deployments.get("FakeWETH")).address,
        }
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
    const subscriptions = await ethers.getContract("CaskSubscriptions");
    return subscriptions.checkUpkeep(checkData);
};

const subscriptionPerformUpkeep = async(performData) => {
    const subscriptions = await ethers.getContract("CaskSubscriptions");
    return subscriptions.performUpkeep(performData);
};

const runSubscriptionKeeper = async(limit) => {
    const abiCoder = new ethers.utils.AbiCoder();
    const checkData = abiCoder.encode(['uint256'], [limit]);
    console.log(`runSubscriptionKeeper checkData: ${checkData}`);
    const checkUpkeep = await subscriptionCheckUpkeep(checkData);

    console.log(`runSubscriptionKeeper checkUpkeep upkeepNeeded: ${checkUpkeep.upkeepNeeded}`);
    console.log(`runSubscriptionKeeper checkUpkeep performData: ${checkUpkeep.performData}`);

    if (checkUpkeep.upkeepNeeded) {
        return subscriptionPerformUpkeep(checkUpkeep.performData);
    } else {
        return false;
    }
};


module.exports = {
    caskUnits,
    usdtUnits,
    usdcUnits,
    daiUnits,
    caskUnitsFormat,
    daiUnitsFormat,
    usdcUnitsFormat,
    usdtUnitsFormat,
    now,
    hour,
    day,
    month,
    year,
    advanceTime,
    getBlockTimestamp,
    isFork,
    isTest,
    isDevnet,
    isLocalhost,
    isMainnet,
    isKovan,
    isPolygon,
    isMumbai,
    isTestnet,
    isRealChain,
    isMemnet,
    isProdnet,
    isDaoChain,
    isProtocolChain,
    loadFixture,
    setOracleTokenPriceUsd,
    getNetworkAddresses,
    advanceBlocks,
    runSubscriptionKeeper,
    subscriptionCheckUpkeep,
    subscriptionPerformUpkeep,
};
