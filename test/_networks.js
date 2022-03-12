const hre = require("hardhat");

const isFork = process.env.FORK === "true";
const isLocalhost = !isFork && hre.network.name === "localhost";
const isMemnet = hre.network.name === "hardhat";

const isKovan = hre.network.name === "kovan";
const isMainnet = hre.network.name === "mainnet";

const isProduction =
    hre.network.name === "production_polygon" ||
    hre.network.name === "production_fantom" ||
    hre.network.name === "production_avax";
const isTestnet =
    hre.network.name === "testnet_mumbai" ||
    hre.network.name === "testnet_fantom" ||
    hre.network.name === "testnet_avax";

const isInternal = hre.network.name === "internal_mumbai"

const isTest = process.env.IS_TEST === "true";

const isDevnet = isLocalhost || isMemnet;
const isRealChain = !isLocalhost && !isMemnet;
const isDaoChain = isMemnet || isFork || isLocalhost || isMainnet || isKovan;
const isProtocolChain = isMemnet || isFork || isLocalhost || isProduction || isTestnet || isInternal;


module.exports = {
    isFork,
    isLocalhost,
    isMemnet,
    isKovan,
    isMainnet,
    isProduction,
    isTestnet,
    isInternal,
    isTest,
    isDevnet,
    isRealChain,
    isDaoChain,
    isProtocolChain,
};