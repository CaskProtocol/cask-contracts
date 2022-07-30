const {
    usdcUnits,
    hour,
} = require("../utils/units");

const {
    isProtocolChain,
    isMemnet,
    isDevnet,
    isTestnet,
} = require("../test/_networks");

const {
    log,
    deployProxyWithConfirmation,
    withConfirmation,
} = require("../utils/deploy");


const deploySubscriptions = async ({ethers, getNamedAccounts}) => {

    const {deployerAddr, governorAddr} = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const sGovernor = await ethers.provider.getSigner(governorAddr);

    log(`Deploying subscriptions contracts`);

    await deployProxyWithConfirmation('CaskSubscriptionPlans');
    await deployProxyWithConfirmation('CaskSubscriptions');
    await deployProxyWithConfirmation('CaskSubscriptionManager');

    const vault = await ethers.getContract("CaskVault");

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
            subscriptionManager.setParameters(
                usdcUnits('0.50'), // paymentMinValue
                usdcUnits('0.05'), // paymentFeeMin
                ethers.BigNumber.from('100'), // paymentFeeRateMin
                ethers.BigNumber.from('100'), // paymentFeeRateMax
                ethers.BigNumber.from('0'), // stakeTargetFactor
                24 * hour, // processBucketSize
                1 * hour, // processBucketMaxAge
                12 * hour // paymentRetryDelay
            )
        );
        log("Set CaskSubscriptionManager parameters for memnet");
    }

    if (isDevnet || isTestnet) {
        await withConfirmation(
            vault.connect(sGovernor).addProtocol(subscriptionManager.address)
        );
        log(`Authorized CaskVault protocol ${subscriptionManager.address} for CaskSubscriptionManager`);
    } else {
        log(`Please authorize CaskSubscriptionManager (${subscriptionManager.address}) as an approved CaskVault protocol`);
    }

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
 * Transfer contract ownerships to governor
 */
const transferOwnerships = async ({ethers, getNamedAccounts}) => {

    const {governorAddr} = await getNamedAccounts();

    const subscriptionPlans = await ethers.getContract("CaskSubscriptionPlans");
    const subscriptions = await ethers.getContract("CaskSubscriptions");
    const subscriptionManager = await ethers.getContract("CaskSubscriptionManager");


    await withConfirmation(
        subscriptionPlans.transferOwnership(governorAddr)
    );
    await withConfirmation(
        subscriptions.transferOwnership(governorAddr)
    );
    await withConfirmation(
        subscriptionManager.transferOwnership(governorAddr)
    );
    log(`Subscriptions contracts ownership transferred to ${governorAddr}`);

}

const main = async (hre) => {
    console.log("Running 005_subscriptions deployment...");
    await deploySubscriptions(hre);
    await transferOwnerships(hre);
    console.log("005_subscriptions deploy done.");
    return true;
};

main.id = "005_subscriptions";
main.tags = ["subscriptions"];
main.dependencies = ["mocks","vault"];
main.skip = () => !isProtocolChain;

module.exports = main;