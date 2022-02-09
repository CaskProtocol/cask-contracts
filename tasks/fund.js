const {
    usdtUnits,
    daiUnits,
    usdcUnits
} = require("../utils/units");

async function fund(taskArguments, hre) {

    const accounts = await hre.ethers.getSigners();

    const usdt = await ethers.getContract("MockUSDT");
    const dai = await ethers.getContract("MockDAI");
    const usdc = await ethers.getContract("MockUSDC");

    const {deployerAddr} = await getNamedAccounts();
    const deployer = await ethers.provider.getSigner(deployerAddr);

    for (const account of accounts) {
        await usdt.connect(deployer).mint(account.address, usdtUnits('10000.0'));
        await dai.connect(deployer).mint(account.address, daiUnits('10000.0'));
        await usdc.connect(deployer).mint(account.address, usdcUnits('10000.0'));
        console.log(`Minted MockUSDT/MockDAI/MockUSDC to ${account.address}`);
    }
}


module.exports = {
    fund,
};
