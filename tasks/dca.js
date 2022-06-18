const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const path = require('path');
const fs = require('fs');


async function dcaMerkleRoot(taskArguments, hre) {

    const network = await hre.ethers.provider.getNetwork();
    const chainId = network.chainId;

    const assetsFilePath = path.resolve(__dirname, '../data/dca_assets.json');
    console.log(`Processing assets file: ${assetsFilePath}`);

    const assetList = JSON.parse(fs.readFileSync(assetsFilePath));
    let filteredAssets;

    if (hre.network.name === "localhost") {
        filteredAssets = assetList;
    } else {
        filteredAssets = assetList.filter((asset) => asset.chainId === chainId);
    }

    console.log(`Loaded ${assetList.length} assets; filtered to ${filteredAssets.length} using chainId ${chainId}`);

    const assetsMerkleRoot = assetMerkleRoot(filteredAssets);

    console.log(`Asset merkle root: ${assetsMerkleRoot}`);

    // const proof = assetMerkleProof(filteredAssets, filteredAssets[0]);
    // console.log(`Asset merkle proof of ${JSON.stringify(filteredAssets[0], null, 2)}: ${proof}`);
    // console.log(`Verify: ${assetMerkleVerify(filteredAssets, filteredAssets[0], proof)}`);

    const { catchUnknownSigner } = hre.deployments;
    const { governorAddr } = await hre.getNamedAccounts();
    const sGovernor = await ethers.provider.getSigner(governorAddr);

    const caskDCA = await ethers.getContract("CaskDCA");

    if (taskArguments.execute === 'true') {
        await catchUnknownSigner(
            caskDCA.connect(sGovernor).setAssetsMerkleRoot(assetsMerkleRoot)
        );
        console.log(`On-chain merkle root updated`);
    } else {
        console.log(`Skipping on-chain execution. Transaction information:`);
        const txnData = caskDCA.interface.encodeFunctionData('setAssetsMerkleRoot', [assetsMerkleRoot]);
        console.log(`       Contract: ${caskDCA.address}`);
        console.log(`       Data: ${txnData}`);
    }

}


function assetMerkleLeafHash(asset) {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
        [ "address[]" ],
        [ [asset.inputAsset, asset.outputAsset, asset.router, asset.priceFeed] ]
    ));
}

function assetMerkleTree(assetList) {
    const elements = assetList.map((asset) => assetMerkleLeafHash(asset));
    return new MerkleTree(elements, keccak256, { sort: true });
}

function assetMerkleRoot(assetList) {
    const merkleTree = assetMerkleTree(assetList);
    return ethers.utils.hexZeroPad(merkleTree.getHexRoot(), 32);
}

function assetMerkleProof(assetList, asset) {
    const merkleTree = assetMerkleTree(assetList);
    return merkleTree.getHexProof(assetMerkleLeafHash(asset));
}

function assetMerkleVerify(assetList, asset, proof) {
    const merkleTree = assetMerkleTree(assetList);
    const leaf = assetMerkleLeafHash(asset);
    return merkleTree.verify(proof, leaf, merkleTree.getHexRoot());
}



module.exports = {
    dcaMerkleRoot,
};
