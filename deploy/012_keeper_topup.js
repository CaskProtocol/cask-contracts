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

const {
    getChainlinkAddresses
} = require("../test/_helpers");

const {
    log,
    deployProxyWithConfirmation,
    withConfirmation,
} = require("../utils/deploy");


const deployKeeperTopup = async ({ethers, getNamedAccounts}) => {

    const {deployerAddr, governorAddr} = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const sGovernor = await ethers.provider.getSigner(governorAddr);
    const chainlinkAddresses = await getChainlinkAddresses(deployments);

    log(`Deploying KeeperTopup contracts`);

    await deployProxyWithConfirmation('CaskKeeperTopup');
    await deployProxyWithConfirmation('CaskKeeperTopupManager');

    const vault = await ethers.getContract("CaskVault");

    const ktu = await ethers.getContract("CaskKeeperTopup");
    await withConfirmation(
        ktu.initialize(10) // group size
    );
    log("Initialized CaskKeeperTopup");

    const ktuManager = await ethers.getContract("CaskKeeperTopupManager");
    await withConfirmation(
        ktuManager.initialize(
            ktu.address,
            vault.address,
            chainlinkAddresses.keeper_registry,
            chainlinkAddresses.ERC20LINK,
            chainlinkAddresses.ERC677LINK,
            chainlinkAddresses.LINK_USD,
            chainlinkAddresses.keeper_swap_router,
            chainlinkAddresses.keeper_swap_path,
            chainlinkAddresses.keeper_peg_swap
        )
    );
    log("Initialized CaskKeeperTopupManager");

    if (isMemnet) {
        await withConfirmation(
            ktuManager.setParameters(
                5, // maxSkips
                60, // topupFeeBps (0.6%)
                usdcUnits('0.1'), // topupFeeMin
                86400+3600, // maxPriceFeedAge (1 day + 1 hour)
                1, // maxTopupsPerRun
                24 * hour, // queueBucketSize
                20 * day // maxQueueAge
            )
        );
        log("Set CaskKeeperTopupManager parameters for memnet");
    }

    await withConfirmation(
        ktu.connect(sDeployer).setManager(ktuManager.address)
    );
    log(`Set CaskKeeperTopup manager to ${ktuManager.address}`);

    if (isDevnet || isTestnet || isInternal) {
        await withConfirmation(
            vault.connect(sGovernor).addProtocol(ktuManager.address)
        );
        log(`Authorized CaskVault protocol ${ktuManager.address} for CaskKeeperTopupManager`);
    } else {
        log(`Please authorize CaskKeeperTopupManager (${ktuManager.address}) as an approved CaskVault protocol`);
    }
}

/**
 * Transfer contract ownerships to governor
 */
const transferOwnerships = async ({ethers, getNamedAccounts}) => {

    const {governorAddr} = await getNamedAccounts();

    const ktu = await ethers.getContract("CaskKeeperTopup");
    const ktuManager = await ethers.getContract("CaskKeeperTopupManager");

    await withConfirmation(
        ktu.transferOwnership(governorAddr)
    );
    await withConfirmation(
        ktuManager.transferOwnership(governorAddr)
    );
    log(`KeeperTopup contracts ownership transferred to ${governorAddr}`);

}

const main = async (hre) => {
    console.log("Running 012_keeper_topup deployment...");
    await deployKeeperTopup(hre);
    await transferOwnerships(hre);
    console.log("012_keeper_topup deploy done.");
    return true;
};

main.id = "012_keeper_topup";
main.tags = ["keeper_topup"];
main.dependencies = ["vault","keeper_topup_mocks"];
main.skip = () => !isProtocolChain;

module.exports = main;