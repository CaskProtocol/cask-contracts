const {
    usdcUnits
} = require("../utils/units");

async function dcaLiquidity(taskArguments, hre) {
    const {
        isFork,
        isLocalhost,
        isInternal,
        isTestnet,
    } = require("../test/_networks");

    if (!isFork && !isLocalhost && !isInternal && !isTestnet) {
        throw new Error("Task can only be used on local, testnets or a fork");
    }

    const router = await ethers.getContract("MockUniswapRouter");

    const usdc = await ethers.getContract("MockUSDC");
    const abc = await ethers.getContract("MockABC");

    const {deployerAddr, governorAddr} = await hre.getNamedAccounts();
    const deployer = await ethers.provider.getSigner(deployerAddr);
    const governor = await ethers.provider.getSigner(governorAddr);

    await router.connect(governor).initialize([usdc.address], [abc.address]);

    await usdc.connect(deployer).mint(router.address, usdcUnits('100000.0'));
    await abc.connect(deployer).mint(router.address, hre.ethers.utils.parseUnits('100000.0', 18));

    console.log(`Funded swap liquidity for USDC/ABC (${usdc.address}/${abc.address}) pair at router ${router.address}`);
}

module.exports = {
    dcaLiquidity,
};
