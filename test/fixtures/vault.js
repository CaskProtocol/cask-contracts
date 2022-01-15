const { deployments } = require("hardhat");

const {
    getNetworkAddresses,
    usdtUnits,
    daiUnits,
    usdcUnits,
    loadFixture
} = require("../_helpers");

async function vaultFixture() {
    await deployments.fixture(); // ensure you start from a fresh deployments

    const networkAddresses = await getNetworkAddresses(deployments);

    // accounts
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const governor = signers[1];
    const strategist = signers[2];
    const consumerA = signers[4];
    const consumerB = signers[5];
    const consumerC = signers[6];
    const providerA = signers[7];
    const providerB = signers[8];
    const providerC = signers[9];


    // contracts
    const vaultAdmin = await ethers.getContract("CaskVaultAdmin");
    const vault = await ethers.getContract("CaskVault");

    return {
        networkAddresses,
        //accounts
        deployer,
        governor,
        strategist,
        consumerA,
        consumerB,
        consumerC,
        providerA,
        providerB,
        providerC,
        //contracts
        vaultAdmin,
        vault,
    };
}

async function fundedFixture() {
    const fixture = await loadFixture(vaultFixture);

    const networkAddresses = await getNetworkAddresses(deployments);

    const usdt = await ethers.getContractAt("MockUSDT", networkAddresses.USDT);
    const dai = await ethers.getContractAt("MockDAI", networkAddresses.DAI);
    const usdc = await ethers.getContractAt("MockUSDC", networkAddresses.USDC);

    for (const consumer of [fixture.consumerA, fixture.consumerB, fixture.consumerC]) {
        await usdt.connect(consumer).mint(usdtUnits('10000.0'));
        await usdt.connect(consumer).approve(fixture.vault.address, usdtUnits('10000.0'));

        await dai.connect(consumer).mint(daiUnits('10000.0'));
        await dai.connect(consumer).approve(fixture.vault.address, daiUnits('10000.0'));

        await usdc.connect(consumer).mint(usdcUnits('10000.0'));
        await usdc.connect(consumer).approve(fixture.vault.address, usdcUnits('10000.0'));
    }

    return fixture;
}


module.exports = {
    vaultFixture,
    fundedFixture,
}