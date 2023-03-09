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

    await router.connect(governor).initialize();

    await usdc.connect(deployer).mint(router.address, usdcUnits('100000.0'));
    await abc.connect(deployer).mint(router.address, hre.ethers.utils.parseUnits('100000.0', 18));

    console.log(`Funded swap liquidity for USDC/ABC (${usdc.address}/${abc.address}) pair at router ${router.address}`);
}


async function dcaUpdateMerkleRoot(taskArguments, hre) {
    const {
        isMainnet,
    } = require("../test/_networks");

    const dca = await ethers.getContract("CaskDCA");

    let dcaAssetAdmin;
    if (isMainnet) {
        dcaAssetAdmin = new ethers.Wallet(process.env['DCA_ASSET_ADMIN_PK'], hre.ethers.provider);
    } else {
        const {dcaAssetAdminAddr} = await hre.getNamedAccounts();
        dcaAssetAdmin = await ethers.provider.getSigner(dcaAssetAdminAddr);
    }

    console.log(`Setting DCA assets merkleroot on ${hre.network.name} as dcaAssetAdmin ${dcaAssetAdmin.address} to ${taskArguments.merkleroot}`);

    const resp = await dca.connect(dcaAssetAdmin).setAssetsMerkleRoot(taskArguments.merkleroot);
    console.log(`Transaction: ${resp.hash}`);
}

module.exports = {
    dcaLiquidity,
    dcaUpdateMerkleRoot,
};
