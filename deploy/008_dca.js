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
} = require("../test/_networks");

const {
    log,
    deployProxyWithConfirmation,
    withConfirmation,
} = require("../utils/deploy");


const deployDCA = async ({ethers, getNamedAccounts}) => {

    const {deployerAddr, governorAddr} = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const sGovernor = await ethers.provider.getSigner(governorAddr);

    log(`Deploying DCA contracts`);

    await deployProxyWithConfirmation('CaskDCA');
    await deployProxyWithConfirmation('CaskDCAManager');

    const vault = await ethers.getContract("CaskVault");

    const assetsMerkleRoot =  ethers.utils.hexZeroPad(0, 32);

    const dca = await ethers.getContract("CaskDCA");
    await withConfirmation(
        dca.initialize(assetsMerkleRoot)
    );
    log("Initialized CaskDCA");

    const dcaManager = await ethers.getContract("CaskDCAManager");
    await withConfirmation(
        dcaManager.initialize(dca.address, vault.address, governorAddr)
    );
    log("Initialized CaskDCAManager");

    if (isMemnet) {
        await withConfirmation(
            dcaManager.setParameters(
                5, // maxSkips
                30, // dcaFeeBps (0.3%)
                usdcUnits('0.1'), // dcaFeeMin
                usdcUnits('1.00'), // dcaMinValue
                86400+3600, // maxPriceFeedAge (1 day + 1 hour)
                24 * hour, // queueBucketSize
                20 * day // maxQueueAge
            )
        );
        log("Set CaskDCAManager parameters for memnet");
    }

    await withConfirmation(
        dca.connect(sDeployer).setManager(dcaManager.address)
    );
    log(`Set CaskDCA manager to ${dcaManager.address}`);

    if (isDevnet || isTestnet) {
        await withConfirmation(
            vault.connect(sGovernor).addProtocol(dcaManager.address)
        );
        log(`Authorized CaskVault protocol ${dcaManager.address} for CaskDCAManager`);
    } else {
        log(`Please authorize CaskDCAManager (${dcaManager.address}) as an approved CaskVault protocol`);
    }
}

/**
 * Transfer contract ownerships to governor
 */
const transferOwnerships = async ({ethers, getNamedAccounts}) => {

    const {governorAddr} = await getNamedAccounts();

    const dca = await ethers.getContract("CaskDCA");
    const dcaManager = await ethers.getContract("CaskDCAManager");

    await withConfirmation(
        dca.transferOwnership(governorAddr)
    );
    await withConfirmation(
        dcaManager.transferOwnership(governorAddr)
    );
    log(`DCA contracts ownership transferred to ${governorAddr}`);

}

const main = async (hre) => {
    console.log("Running 008_dca deployment...");
    await deployDCA(hre);
    await transferOwnerships(hre);
    console.log("008_dca deploy done.");
    return true;
};

main.id = "008_dca";
main.tags = ["dca"];
main.dependencies = ["vault","dca_mocks"];
main.skip = () => !isProtocolChain;

module.exports = main;