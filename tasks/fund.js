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

    for (const account of accounts) {
        await usdt.connect(account).mint(usdtUnits('10000.0'));
        await dai.connect(account).mint(daiUnits('10000.0'));
        await usdc.connect(account).mint(usdcUnits('10000.0'));
        console.log(`Minted MockUSDT/MockDAI/MockUSDC to ${account.address}`);
    }
}


module.exports = {
    fund,
};
