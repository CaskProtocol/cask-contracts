const {
    isProtocolChain,
    isDevnet,
} = require("../test/_networks");

const {
    log,
    deployWithConfirmation,
} = require("../utils/deploy");

/**
 * NOTE:
 * This script ensures the latest version the protocol contracts is always deployed. All upgradable proxy
 * contracts should be listed below so that if they have changed since last deploy, an upgrade will be deployed.
 *
 * The deploy function should never return true so that hardhat deploy does not consider it a one-time migration.
 */

const deployProtocolUpgrade = async () => {
    await upgradeContract('CaskVaultAdmin');
    await upgradeContract('CaskVault');
    await upgradeContract('CaskSubscriptionPlans');
    await upgradeContract('CaskSubscriptions');
    await upgradeContract('CaskSubscriptionManager');
}

const upgradeContract = async (contract) => {
    const current = await deployments.get(`${contract}_Implementation`);
    await deployWithConfirmation(`${contract}_Implementation`, [], contract);
    const newContract = await ethers.getContract(`${contract}_Implementation`);
    if (current.address !== newContract.address) {
        const proxy = await ethers.getContract(contract);
        log(`Contract ${contract} at proxy ${proxy.address} is currently pointed to ${current.address}`);
        log(`   New implementation ready at ${newContract.address}`);
        log(`   Execute as governor: proxyAdmin.connect(governor).upgrade('${proxy.address}', '${newContract.address}');`);
    }
}

const main = async (hre) => {
    console.log("Running 999_protocol_upgrade deployment...");
    await deployProtocolUpgrade(hre);
    console.log("999_protocol_upgrade deploy done.");
};

main.id = "999_protocol_upgrade";
main.tags = ["protocol"];
main.dependencies = ["mocks"];
main.skip = () => !isProtocolChain || isDevnet;

module.exports = main;