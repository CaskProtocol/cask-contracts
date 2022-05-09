const {
    usdtUnits,
    daiUnits,
    usdcUnits,
    ustUnits,
    fraxUnits,
} = require("../utils/units");

async function fund(taskArguments, hre) {

    const accounts = await hre.ethers.getSigners();

    const usdt = await ethers.getContract("MockUSDT");
    const dai = await ethers.getContract("MockDAI");
    const usdc = await ethers.getContract("MockUSDC");
    const ust = await ethers.getContract("MockUST");
    const frax = await ethers.getContract("MockFRAX");

    const {deployerAddr} = await getNamedAccounts();
    const deployer = await ethers.provider.getSigner(deployerAddr);

    for (const account of accounts) {
        await usdt.connect(deployer).mint(account.address, usdtUnits('10000.0'));
        await dai.connect(deployer).mint(account.address, daiUnits('10000.0'));
        await usdc.connect(deployer).mint(account.address, usdcUnits('10000.0'));
        await ust.connect(deployer).mint(account.address, ustUnits('10000.0'));
        await frax.connect(deployer).mint(account.address, fraxUnits('10000.0'));
        console.log(`Minted USDT/DAI/USDC/UST/FRAX to ${account.address}`);
    }
}


module.exports = {
    fund,
};
