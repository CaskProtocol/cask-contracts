const {
    usdtUnits,
    daiUnits,
} = require("../utils/units");

const {
    isProtocolChain,
    isDevnet,
    isTestnet,
    isInternal,
    isBandOracle,
} = require("../test/_networks");

const { getNetworkAddresses } = require("../test/_helpers");

const {
    log,
    deployProxyWithConfirmation,
    withConfirmation,
} = require("../utils/deploy");


const deployVault = async ({deployments, ethers, getNamedAccounts}) => {

    const {governorAddr} = await getNamedAccounts();

    const networkAddresses = await getNetworkAddresses(deployments);
    log(`Deploying protocol contracts using network addresses: ${JSON.stringify(networkAddresses, null, 2)}`);

    await deployProxyWithConfirmation('CaskVault');

    const vault = await ethers.getContract("CaskVault");
    await withConfirmation(
        vault.initialize(
            networkAddresses.USDC, // base asset
            isBandOracle ? networkAddresses.BAND_ORACLE : networkAddresses.USDC_USD, // base asset price feed
            isBandOracle ? 1 : 0,  // oracle type
            governorAddr // governor
        )
    );
    log("Initialized CaskVault");
}

/**
 * Configure Vault by adding supported assets and Strategies.
 */
const configureVault = async ({deployments, ethers, getNamedAccounts}) => {
    const networkAddresses = await getNetworkAddresses(deployments);

    const {deployerAddr, governorAddr} = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const vault = await ethers.getContract("CaskVault");
    const baseAsset = await vault.getBaseAsset();
    const baseAssetInfo = await vault.getAsset(baseAsset);

    await withConfirmation(
        vault.connect(sDeployer).setMinDeposit(ethers.utils.parseUnits('0.01', baseAssetInfo.assetDecimals))
    );
    log("set minDeposit to 0.01");

    if (isDevnet || isTestnet || isInternal) {
        // add testnet assets to vault
        await withConfirmation(
            vault.connect(sDeployer).allowAsset(
                networkAddresses.USDT, // address
                isBandOracle ? networkAddresses.BAND_ORACLE : networkAddresses.USDT_USD, //priceFeed
                usdtUnits('100000000'), // depositLimit - 100M
                10) // slippageBps - 0.1%
        );
        log("Allowed USDT in vault");
        await withConfirmation(
            vault.connect(sDeployer).allowAsset(
                networkAddresses.DAI, // address
                isBandOracle ? networkAddresses.BAND_ORACLE : networkAddresses.DAI_USD, //priceFeed
                daiUnits('100000000'), // depositLimit - 100M
                10) // slippageBps - 0.1%
        );
        log("Allowed DAI in vault");
    }

    await withConfirmation(
        vault.transferOwnership(governorAddr)
    );
    log(`Vault contract ownership transferred to ${governorAddr}`);

}

const main = async (hre) => {
    console.log("Running 004_vault deployment...");
    await deployVault(hre);
    await configureVault(hre);
    console.log("004_vault deploy done.");
    return true;
};

main.id = "004_vault";
main.tags = ["vault"];
main.dependencies = ["mocks"];
main.skip = () => !isProtocolChain;

module.exports = main;