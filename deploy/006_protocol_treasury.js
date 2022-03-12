
const {
    isProtocolChain,
    isDevnet,
} = require("../test/_networks");

const {
    withConfirmation,
    log,
    deployWithConfirmation
} = require("../utils/deploy");

const deployProtocolTreasury = async () => {
    const {deployerAddr, governorAddr} = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    await deployWithConfirmation('CaskTreasury');

    const caskTreasury = await ethers.getContract("CaskTreasury");

    const result = await withConfirmation(
        caskTreasury.connect(sDeployer).transferOwnership(governorAddr)
    );
    log(`Transferred CaskTreasury ownership to ${governorAddr}`, result);

}


const main = async (hre) => {
    console.log("Running 006_protocol_treasury deployment...");
    await deployProtocolTreasury(hre);
    console.log("006_protocol_treasury deploy done.");
    return true;
};

main.id = "006_protocol_treasury";
main.tags = ["protocol"];
main.skip = () => !isProtocolChain || isDevnet;

module.exports = main;