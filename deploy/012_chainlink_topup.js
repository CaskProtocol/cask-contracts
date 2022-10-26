const {
    usdcUnits,
    hour,
    day,
} = require("../utils/units");

const {
    isProtocolChain,
    isMemnet,
    isDevnet,
    isTestnet,
    isInternal,
} = require("../test/_networks");

const addresses = require("../utils/addresses");

const {
    getChainlinkAddresses
} = require("../test/_helpers");


const {
    log,
    deployProxyWithConfirmation,
    withConfirmation,
} = require("../utils/deploy");


const deployChainlinkTopup = async ({ethers, getNamedAccounts}) => {

    const {deployerAddr, governorAddr} = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const sGovernor = await ethers.provider.getSigner(governorAddr);
    const chainlinkAddresses = await getChainlinkAddresses(deployments);

    log(`Deploying ChainlinkTopup contracts`);

    await deployProxyWithConfirmation('CaskChainlinkTopup');
    await deployProxyWithConfirmation('CaskChainlinkTopupManager');

    const vault = await ethers.getContract("CaskVault");

    const ktu = await ethers.getContract("CaskChainlinkTopup");
    await withConfirmation(
        ktu.initialize(10) // group size
    );
    log("Initialized CaskChainlinkTopup");

    const ktuManager = await ethers.getContract("CaskChainlinkTopupManager");
    await withConfirmation(
        ktuManager.initialize(
            ktu.address,
            vault.address,
            chainlinkAddresses.ERC20LINK,
            chainlinkAddresses.ERC677LINK,
            chainlinkAddresses.LINK_USD,
            chainlinkAddresses.link_swap_router,
            chainlinkAddresses.link_swap_path,
            addresses.zero,
            governorAddr
        )
    );
    log("Initialized CaskChainlinkTopupManager");

    if (isMemnet) {
        await withConfirmation(
            ktuManager.setParameters(
                5, // maxSkips
                60, // topupFeeBps (0.6%)
                usdcUnits('0.1'), // topupFeeMin
                86400+3600, // maxPriceFeedAge (1 day + 1 hour)
                1, // maxTopupsPerRun
                100, // maxSwapSlippageBps
                24 * hour, // queueBucketSize
                20 * day // maxQueueAge
            )
        );
        log("Set CaskChainlinkTopupManager parameters for memnet");
    }

    await withConfirmation(
        ktu.connect(sDeployer).setManager(ktuManager.address)
    );
    log(`Set CaskChainlinkTopup manager to ${ktuManager.address}`);

    if (isDevnet || isTestnet || isInternal) {
        await withConfirmation(
            vault.connect(sGovernor).addProtocol(ktuManager.address)
        );
        log(`Authorized CaskVault protocol ${ktuManager.address} for CaskChainlinkTopupManager`);
    } else {
        log(`Please authorize CaskChainlinkTopupManager (${ktuManager.address}) as an approved CaskVault protocol`);
    }
}

/**
 * Transfer contract ownerships to governor
 */
const transferOwnerships = async ({ethers, getNamedAccounts}) => {

    const {governorAddr} = await getNamedAccounts();

    const ktu = await ethers.getContract("CaskChainlinkTopup");
    const ktuManager = await ethers.getContract("CaskChainlinkTopupManager");

    await withConfirmation(
        ktu.transferOwnership(governorAddr)
    );
    await withConfirmation(
        ktuManager.transferOwnership(governorAddr)
    );
    log(`ChainlinkTopup contracts ownership transferred to ${governorAddr}`);

}

const main = async (hre) => {
    console.log("Running 012_chainlink_topup deployment...");
    await deployChainlinkTopup(hre);
    await transferOwnerships(hre);
    console.log("012_chainlink_topup deploy done.");
    return true;
};

main.id = "012_chainlink_topup";
main.tags = ["chainlink_topup"];
main.dependencies = ["vault","chainlink_topup_mocks"];
main.skip = () => !isProtocolChain;

module.exports = main;