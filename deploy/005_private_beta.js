
const { isProtocolChain } = require("../test/_networks");
const { deployProxyWithConfirmation, withConfirmation, log} = require("../utils/deploy");

const deployPrivateBeta = async () => {
    const {deployerAddr, governorAddr} = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    await deployProxyWithConfirmation("CaskPrivateBeta");

    const privateBeta = await ethers.getContract("CaskPrivateBeta");

    await withConfirmation(
        privateBeta.initialize()
    );
    log("Initialized CaskPrivateBeta");

    const result = await withConfirmation(
        privateBeta.connect(sDeployer).transferOwnership(governorAddr)
    );
    log(`Transferred CaskPrivateBeta ownership to ${governorAddr}`, result);

}


const main = async (hre) => {
    console.log("Running 005_private_beta deployment...");
    await deployPrivateBeta(hre);
    console.log("005_private_beta deploy done.");
    return true;
};

main.id = "005_private_beta";
main.tags = ["private_beta"];
main.skip = () => !isProtocolChain;

module.exports = main;