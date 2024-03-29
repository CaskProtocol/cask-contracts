const hre = require("hardhat");

const isFork = process.env.FORK === "true";
const isLocalhost = !isFork && hre.network.name === "localhost";
const isMemnet = hre.network.name === "hardhat";

const isEthereum = hre.network.name === 'ethereum';
const isMainnet = hre.network.name.startsWith('mainnet_');
const isTestnet = hre.network.name.startsWith('testnet_');
const isInternal = hre.network.name.startsWith('internal_');

const supportChainlinkAutomation =
    isLocalhost || isMemnet || isTestnet || isInternal ||
    hre.network.name === 'mainnet_arbitrum' ||
    hre.network.name === 'mainnet_avalanche' ||
    hre.network.name === 'mainnet_polygon' ||
    hre.network.name === 'mainnet_optimism' ||
    hre.network.name === 'mainnet_bsc';

const isTest = process.env.IS_TEST === "true";

const isDevnet = isLocalhost || isMemnet;
const isRealChain = !isLocalhost && !isMemnet;
const isDaoChain = isMemnet || isLocalhost || isEthereum;
const isProtocolChain = isMemnet || isFork || isLocalhost || isMainnet || isTestnet || isInternal;


module.exports = {
    isFork,
    isLocalhost,
    isMemnet,
    isEthereum,
    isMainnet,
    isTestnet,
    isInternal,
    isTest,
    isDevnet,
    isRealChain,
    isDaoChain,
    isProtocolChain,
    supportChainlinkAutomation,
};