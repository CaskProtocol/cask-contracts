const {
    usdtUnits,
    usdcUnits,
    daiUnits
} = require("../utils/units");

const {
    isProtocolChain,
} = require("../test/_networks");

const { getNetworkAddresses } = require("../test/_helpers");

const {
    log,
    deployProxyWithConfirmation,
    withConfirmation,
} = require("../utils/deploy");


const deployProtocol = async ({deployments, ethers, getNamedAccounts}) => {

    const {deployerAddr, governorAddr} = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const networkAddresses = await getNetworkAddresses(deployments);
    log(`Deploying protocol contracts using network addresses: ${JSON.stringify(networkAddresses, null, 2)}`);

    await deployProxyWithConfirmation('CaskVaultManager');
    await deployProxyWithConfirmation('CaskVault');
    await deployProxyWithConfirmation('CaskSubscriptionPlans');
    await deployProxyWithConfirmation('CaskSubscriptions');
    await deployProxyWithConfirmation('CaskSubscriptionManager');

    const vaultManager = await ethers.getContract("CaskVaultManager");
    await withConfirmation(
        vaultManager.initialize(0, 0)
    );
    log("Initialized CaskVaultManager");

    const vault = await ethers.getContract("CaskVault");
    await withConfirmation(
        vault.initialize(vaultManager.address, networkAddresses.DAI, governorAddr)
    );
    log("Initialized CaskVault");

    await withConfirmation(
        vaultManager.connect(sDeployer).setVault(vault.address)
    );
    log("Connected CaskVault to CaskVaultManager");

    const subscriptionPlans = await ethers.getContract("CaskSubscriptionPlans");
    await withConfirmation(
        subscriptionPlans.initialize()
    );
    log("Initialized CaskSubscriptionPlans");

    const subscriptions = await ethers.getContract("CaskSubscriptions");
    await withConfirmation(
        subscriptions.initialize(subscriptionPlans.address)
    );
    log("Initialized CaskSubscriptions");

    const subscriptionManager = await ethers.getContract("CaskSubscriptionManager");
    await withConfirmation(
        subscriptionManager.initialize(vault.address, subscriptionPlans.address, subscriptions.address)
    );
    log("Initialized CaskSubscriptionManager");

    await withConfirmation(
        vault.connect(sDeployer).addOperator(subscriptionManager.address)
    );
    log(`Added CaskVault operator ${subscriptionManager.address} for CaskSubscriptionManager`);

    await withConfirmation(
        subscriptions.connect(sDeployer).setManager(subscriptionManager.address)
    );
    log(`Set CaskSubscriptions manager to ${subscriptionManager.address}`);

    await withConfirmation(
        subscriptionPlans.connect(sDeployer).setManager(subscriptionManager.address)
    );
    log(`Set CaskSubscriptionPlans manager to ${subscriptionManager.address}`);


}

/**
 * Configure Vault by adding supported assets and Strategies.
 */
const configureVault = async ({deployments, ethers, getNamedAccounts}) => {
    const networkAddresses = await getNetworkAddresses(deployments);

    const {deployerAddr, governorAddr} = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const vaultManager = await ethers.getContract("CaskVaultManager");
    const vault = await ethers.getContract("CaskVault");
    const subscriptionPlans = await ethers.getContract("CaskSubscriptionPlans");
    const subscriptions = await ethers.getContract("CaskSubscriptions");
    const subscriptionManager = await ethers.getContract("CaskSubscriptionManager");

    // add supported assets to vault

    await vault.connect(sDeployer).allowAsset(
        networkAddresses.USDT, // address
        networkAddresses.USDT_USD, //priceFeed
        usdtUnits('100000000'), // depositLimit - 100M
        10, // slippageBps - 0.1%
    );
    log("Allowed USDT in vault");

    await vault.connect(sDeployer).allowAsset(
        networkAddresses.DAI, // address
        networkAddresses.DAI_USD, //priceFeed
        daiUnits('100000000'), // depositLimit - 100M
        10, // slippageBps - 0.1%
    );
    log("Allowed DAI in vault");

    await vault.connect(sDeployer).allowAsset(
        networkAddresses.USDC, // address
        networkAddresses.USDC_USD, //priceFeed
        usdcUnits('100000000'), // depositLimit - 100M
        10, // slippageBps - 0.1%
    );
    log("Allowed USDC in vault");


    await vaultManager.transferOwnership(governorAddr);
    await vault.transferOwnership(governorAddr);
    await subscriptionPlans.transferOwnership(governorAddr);
    await subscriptions.transferOwnership(governorAddr);
    await subscriptionManager.transferOwnership(governorAddr);
    log(`Protocol contracts ownership transferred to ${governorAddr}`);

}

const main = async (hre) => {
    console.log("Running 004_protocol deployment...");
    await deployProtocol(hre);
    await configureVault(hre);
    console.log("004_protocol deploy done.");
    return true;
};

main.id = "004_protocol";
main.tags = ["protocol"];
main.dependencies = ["mocks"];
main.skip = () => !isProtocolChain;

module.exports = main;