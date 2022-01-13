const {
    isFork
} = require("../_helpers");

const addresses = require("../../utils/addresses");

async function vaultFixture() {
    await deployments.fixture(); // ensure you start from a fresh deployments

    // accounts
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const governor = signers[1];
    const strategist = signers[2];

    // assets
    let usdt,
        dai,
        usdc,
        weth;

    if (isFork) {
        usdt = await ethers.getContractAt("IERC20", addresses.polygon.USDT);
        dai = await ethers.getContractAt("IERC20", addresses.polygon.DAI);
        usdc = await ethers.getContractAt("IERC20", addresses.polygon.USDC);
        weth = await ethers.getContractAt("IERC20", addresses.polygon.WETH);
    } else {
        usdt = await ethers.getContract("MockUSDT");
        dai = await ethers.getContract("MockDAI");
        usdc = await ethers.getContract("MockUSDC");
        weth = await ethers.getContract("MockWETH");
    }

    // contracts
    const vaultAdmin = await ethers.getContract("CaskVaultAdmin");
    const vault = await ethers.getContract("CaskVault");

    return {
        //accounts
        deployer,
        governor,
        strategist,
        // assets
        usdt,
        dai,
        usdc,
        weth,
        //contracts
        vaultAdmin,
        vault,
    };
}


module.exports = {
    vaultFixture,
}