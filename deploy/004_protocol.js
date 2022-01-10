
const addresses = require("../utils/addresses");
const {
    getNetworkAddresses,
    isProtocolChain,
    usdtUnits,
    usdcUnits,
    daiUnits
} = require("../test/_helpers.js");

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

    await deployProxyWithConfirmation('CaskVaultAdmin');
    await deployProxyWithConfirmation('CaskVault');
    await deployProxyWithConfirmation('CaskSubscriptionPlans');
    await deployProxyWithConfirmation('CaskSubscriptions');

    const vaultAdmin = await ethers.getContract("CaskVaultAdmin");
    await withConfirmation(
        vaultAdmin.initialize(0, 0)
    );
    log("Initialized CaskVaultAdmin");

    const vault = await ethers.getContract("CaskVault");
    await withConfirmation(
        vault.initialize(vaultAdmin.address, networkAddresses.DAI)
    );
    log("Initialized CaskVault");

    await withConfirmation(
        vaultAdmin.connect(sDeployer).setVault(vault.address)
    );
    log("Connected CaskVault to CaskVaultAdmin");

    const subscriptionPlans = await ethers.getContract("CaskSubscriptionPlans");
    await withConfirmation(
        subscriptionPlans.initialize()
    );
    log("Initialized CaskSubscriptionPlans");

    const subscriptions = await ethers.getContract("CaskSubscriptions");
    await withConfirmation(
        subscriptions.initialize(subscriptionPlans.address, vault.address)
    );
    log("Initialized CaskSubscriptions");

    await withConfirmation(
        subscriptionPlans.connect(sDeployer).setProtocol(subscriptions.address)
    );
    log(`Set CaskSubscriptionPlans protocol to ${subscriptions.address}`);

    await withConfirmation(
        vault.connect(sDeployer).addOperator(subscriptions.address)
    );
    log(`Added CaskVault operator ${subscriptions.address} for CaskSubscriptions`);

}

/**
 * Configure Vault by adding supported assets and Strategies.
 */
const configureVault = async ({deployments, ethers, getNamedAccounts}) => {
    const networkAddresses = await getNetworkAddresses(deployments);

    const {deployerAddr, governorAddr} = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const vaultAdmin = await ethers.getContract("CaskVaultAdmin");
    const vault = await ethers.getContract("CaskVault");
    const subscriptionPlans = await ethers.getContract("CaskSubscriptionPlans");
    const subscriptions = await ethers.getContract("CaskSubscriptions");

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


    await vaultAdmin.transferOwnership(governorAddr);
    await vault.transferOwnership(governorAddr);
    await subscriptionPlans.transferOwnership(governorAddr);
    await subscriptions.transferOwnership(governorAddr);
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
main.dependencies = ["fakes","mocks"];
main.skip = () => !isProtocolChain;

module.exports = main;