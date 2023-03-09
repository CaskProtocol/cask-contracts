const {
    isProtocolChain,
    isDevnet,
    isTestnet,
    isInternal,
} = require("../test/_networks");

const {
    log,
    withConfirmation,
    deployWithConfirmation,
} = require("../utils/deploy");

const {
    getNetworkAddresses
} = require("../test/_helpers");

const deployNFTRenderers = async ({ethers, getNamedAccounts}) => {

    const {governorAddr} = await getNamedAccounts();
    const sGovernor = await ethers.provider.getSigner(governorAddr);
    const networkAddresses = await getNetworkAddresses(deployments);

    log(`Deploying NFT renderer contracts`);

    const vault = await ethers.getContract("CaskVault");

    await deployWithConfirmation("DCANFTRenderer");
    await deployWithConfirmation("P2PNFTRenderer", [await vault.getBaseAsset(), networkAddresses.ens_reverse_registry]);

    if (isDevnet || isTestnet || isInternal) {
        const dca = await ethers.getContract("CaskDCA");
        const p2p = await ethers.getContract("CaskP2P");

        const dcaNftRenderer = await ethers.getContract("DCANFTRenderer");
        const p2pNftRenderer = await ethers.getContract("P2PNFTRenderer");

        await withConfirmation(
            dca.connect(sGovernor).setNFTRenderer(dcaNftRenderer.address)
        );
        log(`Set CaskDCA NFTRenderer to ${dcaNftRenderer.address}`);

        await withConfirmation(
            p2p.connect(sGovernor).setNFTRenderer(p2pNftRenderer.address)
        );
        log(`Set CaskP2P NFTRenderer to ${p2pNftRenderer.address}`);
    } else {
        log(`NFT Renderers deployed and ready for use in production contracts`);
    }
}

const main = async (hre) => {
    console.log("Running 013_nft_renderers deployment...");
    await deployNFTRenderers(hre);
    console.log("013_nft_renderers deploy done.");
};

main.id = "013_nft_renderers";
main.tags = ["nft_renderers"];
main.dependencies = ["vault","dca","p2p"];
main.skip = () => !isProtocolChain;

module.exports = main;