const hre = require("hardhat");

const isFork = process.env.FORK === "true";
const isLocalhost = !isFork && hre.network.name === "localhost";
const isMemnet = hre.network.name === "hardhat";

const isMainnet = hre.network.name === "mainnet";

const isProduction = hre.network.name.startsWith('production_');
const isTestnet = hre.network.name.startsWith('testnet_');
const isInternal = hre.network.name.startsWith('internal_');

const isTest = process.env.IS_TEST === "true";

const isDevnet = isLocalhost || isMemnet;
const isRealChain = !isLocalhost && !isMemnet;
const isDaoChain = isMemnet || isFork || isLocalhost || isMainnet;
const isProtocolChain = isMemnet || isFork || isLocalhost || isProduction || isTestnet || isInternal;


module.exports = {
    isFork,
    isLocalhost,
    isMemnet,
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