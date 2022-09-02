const {
    hour, day,
} = require("../utils/units");

const {
    isProtocolChain,
    isMemnet,
    isDevnet,
    isTestnet,
    isInternal,
} = require("../test/_networks");

const {
    log,
    deployProxyWithConfirmation,
    withConfirmation,
} = require("../utils/deploy");


const deployP2P = async ({ethers, getNamedAccounts}) => {

    const {deployerAddr, governorAddr} = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const sGovernor = await ethers.provider.getSigner(governorAddr);

    log(`Deploying P2P contracts`);

    await deployProxyWithConfirmation('CaskP2P');
    await deployProxyWithConfirmation('CaskP2PManager');

    const vault = await ethers.getContract("CaskVault");

    const p2p = await ethers.getContract("CaskP2P");
    await withConfirmation(
        p2p.initialize()
    );
    log("Initialized CaskP2P");

    const p2pManager = await ethers.getContract("CaskP2PManager");
    await withConfirmation(
        p2pManager.initialize(p2p.address, vault.address)
    );
    log("Initialized CaskP2PManager");

    if (isMemnet) {
        await withConfirmation(
            p2pManager.setParameters(
                5, // maxSkips
                500000, // 0.50 fee in USDC
                24 * hour, // queueBucketSize
                20 * day // maxQueueAge
            )
        );
        log("Set CaskP2PManager parameters for memnet");
    }

    await withConfirmation(
        p2p.connect(sDeployer).setManager(p2pManager.address)
    );
    log(`Set CaskP2P manager to ${p2pManager.address}`);

    if (isDevnet || isTestnet || isInternal) {
        await withConfirmation(
            vault.connect(sGovernor).addProtocol(p2pManager.address)
        );
        log(`Authorized CaskVault protocol ${p2pManager.address} for CaskP2PManager`);
    } else {
        log(`Please authorize CaskP2PManager (${p2pManager.address}) as an approved CaskVault protocol`);
    }
}

/**
 * Transfer contract ownerships to governor
 */
const transferOwnerships = async ({ethers, getNamedAccounts}) => {

    const {governorAddr} = await getNamedAccounts();

    const p2p = await ethers.getContract("CaskP2P");
    const p2pManager = await ethers.getContract("CaskP2PManager");

    await withConfirmation(
        p2p.transferOwnership(governorAddr)
    );
    await withConfirmation(
        p2pManager.transferOwnership(governorAddr)
    );
    log(`P2P contracts ownership transferred to ${governorAddr}`);

}

const main = async (hre) => {
    console.log("Running 009_p2p deployment...");
    await deployP2P(hre);
    await transferOwnerships(hre);
    console.log("009_p2p deploy done.");
    return true;
};

main.id = "009_p2p";
main.tags = ["p2p"];
main.dependencies = ["vault"];
main.skip = () => !isProtocolChain;

module.exports = main;