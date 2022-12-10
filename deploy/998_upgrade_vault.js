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

const main = async (hre) => {

    await upgradeProxyWithConfirmation('CaskVault');

};

main.id = "998_upgrade_vault";
main.tags = ["upgrade_vault"];
main.dependencies = ["vault"];
main.skip = () => !isProtocolChain || isDevnet;

module.exports = main;