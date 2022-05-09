const {
    usdtUnits,
    usdcUnits,
    daiUnits,
    ustUnits,
    fraxUnits,
    day,
    hour,
} = require("../utils/units");

const {
    isProtocolChain,
    isMemnet,
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
        vault.initialize(vaultManager.address, networkAddresses.USDC, networkAddresses.USDC_USD, governorAddr)
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

    await withConfirmation(
        subscriptionPlans.setSubscriptions(subscriptions.address)
    );
    log("Set CaskSubscriptions address in CaskSubscriptionPlans");

    const subscriptionManager = await ethers.getContract("CaskSubscriptionManager");
    await withConfirmation(
        subscriptionManager.initialize(vault.address, subscriptionPlans.address, subscriptions.address)
    );
    log("Initialized CaskSubscriptionManager");
    if (isMemnet) {
        await withConfirmation(
            subscriptionManager.setParameters(0, 0, 0, 0, 6 * hour)
        );
        log("Set CaskSubscriptionManager parameters for memnet");
    }

    await withConfirmation(
        vault.connect(sDeployer).addProtocol(subscriptionManager.address)
    );
    log(`Authorized CaskVault protocol ${subscriptionManager.address} for CaskSubscriptionManager`);

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

    await withConfirmation(
        vault.connect(sDeployer).setMinDeposit(usdcUnits('0.01'))
    );
    log("set minDeposit to 0.01 USDC");


    // add supported assets to vault

    await withConfirmation(
        vault.connect(sDeployer).allowAsset(
            networkAddresses.USDT, // address
            networkAddresses.USDT_USD, //priceFeed
            usdtUnits('100000000'), // depositLimit - 100M
            10) // slippageBps - 0.1%
    );
    log("Allowed USDT in vault");

    await withConfirmation(
        vault.connect(sDeployer).allowAsset(
            networkAddresses.DAI, // address
            networkAddresses.DAI_USD, //priceFeed
            daiUnits('100000000'), // depositLimit - 100M
            10) // slippageBps - 0.1%
    );
    log("Allowed DAI in vault");

    await withConfirmation(
        vault.connect(sDeployer).allowAsset(
            networkAddresses.UST, // address
            networkAddresses.UST_USD, //priceFeed
            ustUnits('100000000'), // depositLimit - 100M
            10) // slippageBps - 0.1%
    );
    log("Allowed UST in vault");

    await withConfirmation(
        vault.connect(sDeployer).allowAsset(
            networkAddresses.FRAX, // address
            networkAddresses.FRAX_USD, //priceFeed
            fraxUnits('100000000'), // depositLimit - 100M
            10) // slippageBps - 0.1%
    );
    log("Allowed FRAX in vault");


    await withConfirmation(
        vaultManager.transferOwnership(governorAddr)
    );
    await withConfirmation(
        vault.transferOwnership(governorAddr)
    );
    await withConfirmation(
        subscriptionPlans.transferOwnership(governorAddr)
    );
    await withConfirmation(
        subscriptions.transferOwnership(governorAddr)
    );
    await withConfirmation(
        subscriptionManager.transferOwnership(governorAddr)
    );
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