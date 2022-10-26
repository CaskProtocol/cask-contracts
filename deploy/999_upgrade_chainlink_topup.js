const {
    isProtocolChain,
    isDevnet,
} = require("../test/_networks");

const {
    log,
    upgradeProxyWithConfirmation,
} = require("../utils/deploy");

/**
 * NOTE:
 * This script ensures the latest version the protocol contracts is always deployed. All upgradable proxy
 * contracts should be listed below so that if they have changed since last deploy, an upgrade will be deployed.
 *
 * The deploy function should never return true so that hardhat deploy does not consider it a one-time migration.
 */

const deployUpgrades = async () => {

    await upgradeProxyWithConfirmation('CaskChainlinkTopup');
    await upgradeProxyWithConfirmation('CaskChainlinkTopupManager');

}

const main = async (hre) => {
    console.log("Running 999_upgrade_chainlink_topup deployment...");
    await deployUpgrades(hre);
    console.log("999_upgrade_chainlink_topup deploy done.");
};

main.id = "999_upgrade_chainlink_topup";
main.tags = ["upgrade_chainlink_topup"];
main.dependencies = ["chainlink_topup"];
main.skip = () => !isProtocolChain || isDevnet;

module.exports = main;