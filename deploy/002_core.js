const {
    isDaoChain,
} = require("../test/_helpers.js");

const {
    log,
    deployWithConfirmation,
    withConfirmation,
} = require("../utils/deploy");


const deployCore = async ({ethers, getNamedAccounts}) => {

    const {deployerAddr, governorAddr} = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // skip on non-DAI chains as L2's tend to have own way to handle token mapping
    if (isDaoChain) {
        await deployWithConfirmation('CaskToken');
    }

    await deployWithConfirmation('CaskTreasury');

    const caskTreasury = await ethers.getContract("CaskTreasury");

    await withConfirmation(
        caskTreasury.connect(sDeployer).transferOwnership(governorAddr)
    );
    log(`Transferred CaskTreasury ownership to ${governorAddr}`);

}


const main = async (hre) => {
    console.log("Running 002_core deployment...");
    await deployCore(hre);
    console.log("002_core deploy done.");
    return true;
};

main.id = "002_core";
main.tags = ["core"];

module.exports = main;