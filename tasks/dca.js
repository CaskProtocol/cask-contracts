const fs = require('fs');
const { CaskSDK } = require('@caskprotocol/sdk');

const {
    usdcUnits
} = require("../utils/units");


async function dcaMerkleRoot(taskArguments, hre) {

    const network = await hre.ethers.provider.getNetwork();
    const chainId = network.chainId;

    const assetList = JSON.parse(fs.readFileSync(taskArguments.file));
    const filteredAssets = assetList.filter((asset) => asset.chainId === chainId);

    console.log(`Loaded ${assetList.length} assets; filtered to ${filteredAssets.length} using chainId ${chainId}`);

    const assetsMerkleRoot = CaskSDK.utils.dcaMerkleRoot(filteredAssets);

    console.log(`Asset merkle root: ${assetsMerkleRoot}`);

    const { catchUnknownSigner } = hre.deployments;
    const { governorAddr } = await hre.getNamedAccounts();
    const sGovernor = await ethers.provider.getSigner(governorAddr);

    const caskDCA = await ethers.getContract("CaskDCA");

    if (taskArguments.execute === 'true') {
        const promise = caskDCA.connect(sGovernor).setAssetsMerkleRoot(assetsMerkleRoot);
        const manualTxn = await catchUnknownSigner(promise);
        if (manualTxn) {
            console.log(`Please execute above txn via governance`);
        } else {
            const result = await promise;
            console.log(`On-chain merkle root updated. txn: ${result.hash}`);
        }
    } else {
        console.log(`Skipping on-chain execution. Transaction information:`);
        const txnData = caskDCA.interface.encodeFunctionData('setAssetsMerkleRoot', [assetsMerkleRoot]);
        console.log(`       Code: CaskDCA.setAssetsMerkleRoot("${assetsMerkleRoot}");`);
        console.log(`       Contract: ${caskDCA.address}`);
        console.log(`       Data: ${txnData}`);
    }
}

async function dcaLiquidity(taskArguments, hre) {
    const {
        isFork,
        isLocalhost,
    } = require("../test/_networks");

    if (!isFork && !isLocalhost) {
        throw new Error("Task can only be used on local or fork");
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

    console.log(`Funded swap liquidity for USDC/ABC pair at router ${router.address}`);
}



module.exports = {
    dcaMerkleRoot,
    dcaLiquidity,
};
