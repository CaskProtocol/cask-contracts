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

    await upgradeProxyWithConfirmation('CaskDCA');
    await upgradeProxyWithConfirmation('CaskDCAManager');

}

const main = async (hre) => {
    console.log("Running 999_upgrade_dca deployment...");
    await deployUpgrades(hre);
    console.log("999_upgrade_dca deploy done.");
};

main.id = "999_upgrade_dca";
main.tags = ["upgrade_dca"];
main.dependencies = ["dca"];
main.skip = () => !isProtocolChain || isDevnet;

module.exports = main;