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

    await upgradeProxyWithConfirmation('CaskVault');
    await upgradeProxyWithConfirmation('CaskSubscriptionPlans');
    await upgradeProxyWithConfirmation('CaskSubscriptions');
    await upgradeProxyWithConfirmation('CaskSubscriptionManager');

}

const main = async (hre) => {
    console.log("Running 999_upgrade_subscriptions deployment...");
    await deployUpgrades(hre);
    console.log("999_upgrade_subscriptions deploy done.");
};

main.id = "999_upgrade_subscriptions";
main.tags = ["upgrade_subscriptions"];
main.dependencies = ["vault","subscriptions"];
main.skip = () => !isProtocolChain || isDevnet;

module.exports = main;