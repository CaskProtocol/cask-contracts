const hre = require("hardhat");

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


module.exports = {
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
};