const hre = require("hardhat");

async function main() {

    const addresses = await hre.ethers.getSigners();

    const CaskVault = await hre.ethers.getContractFactory("CaskVault");
    const caskVault = await hre.upgrades.deployProxy(CaskVault);
    console.log("CaskVault proxy deployed to:", caskVault.address);
    console.log("CaskVault implementation:", await hre.upgrades.erc1967.getImplementationAddress(caskVault.address));

    const CaskProtocol = await hre.ethers.getContractFactory("CaskProtocol");
    const caskProtocol = await hre.upgrades.deployProxy(CaskProtocol, [caskVault.address]);
    console.log("CaskProtocol proxy deployed to:", caskProtocol.address);
    console.log("CaskProtocol implementation:", await hre.upgrades.erc1967.getImplementationAddress(caskProtocol.address));

    const operatorRole = await caskVault.OPERATOR_ROLE();

    // Allow protocol to operate the vault
    await caskVault.grantRole(operatorRole, caskProtocol.address);
    console.log("CaskVault added OPERATOR_ROLE of:", caskProtocol.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
