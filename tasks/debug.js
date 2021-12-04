const { parseUnits, formatUnits } = require("ethers").utils;


async function _debug_core(taskArguments, hre) {

    const caskToken = await hre.ethers.getContract("CaskToken");
    const caskTreasury = await hre.ethers.getContract("CaskTreasury");

    //
    // Core Addresses
    //
    console.log("\nCore Contract addresses");
    console.log("====================");

    console.log(`CASK Token:                             ${caskToken.address}`);
    console.log(`CaskTreasury:                           ${caskTreasury.address}`);
    console.log(`CaskTreasury Owner:                     ${await caskTreasury.owner()}`);
    console.log(`CaskTreasury CASK Balance:              ${formatUnits(await caskToken.balanceOf(caskTreasury.address), 18)}`);

}

async function _debug_dao(taskArguments, hre) {

    const caskVestedEscrow = await hre.ethers.getContract("CaskVestedEscrow");
    const teamVestedEscrow = await hre.ethers.getContract("TeamVestedEscrow");

    //
    // DAO Addresses
    //
    console.log("\nDAO Contract addresses");
    console.log("====================");

    console.log(`CaskVestedEscrow:                       ${caskVestedEscrow.address}`);
    console.log(`CaskVestedEscrow Admin:                 ${await caskVestedEscrow.admin()}`);
    console.log(`CaskVestedEscrow FundAdmin:             ${await caskVestedEscrow.fundAdmin()}`);
    console.log(`CaskVestedEscrow initialLockedSupply:   ${formatUnits(await caskVestedEscrow.initialLockedSupply(), 18)}`);
    console.log(`CaskVestedEscrow unallocatedSupply:     ${formatUnits(await caskVestedEscrow.unallocatedSupply(), 18)}`);
    console.log(`CaskVestedEscrow vestedSupply:          ${formatUnits(await caskVestedEscrow.vestedSupply(), 18)}`);
    console.log(`CaskVestedEscrow lockedSupply:          ${formatUnits(await caskVestedEscrow.lockedSupply(), 18)}`);

    console.log(`TeamVestedEscrow:                       ${teamVestedEscrow.address}`);
    console.log(`TeamVestedEscrow Admin:                 ${await teamVestedEscrow.admin()}`);
    console.log(`TeamVestedEscrow FundAdmin:             ${await teamVestedEscrow.fundAdmin()}`);
    console.log(`TeamVestedEscrow initialLockedSupply:   ${formatUnits(await teamVestedEscrow.initialLockedSupply(), 18)}`);
    console.log(`TeamVestedEscrow unallocatedSupply:     ${formatUnits(await teamVestedEscrow.unallocatedSupply(), 18)}`);
    console.log(`TeamVestedEscrow vestedSupply:          ${formatUnits(await teamVestedEscrow.vestedSupply(), 18)}`);
    console.log(`TeamVestedEscrow lockedSupply:          ${formatUnits(await teamVestedEscrow.lockedSupply(), 18)}`);

}

async function _debug_protocol(taskArguments, hre) {

    const vaultAdmin = await hre.ethers.getContract("CaskVaultAdmin");
    const vault = await hre.ethers.getContract("CaskVault");
    const subscriptionPlans = await hre.ethers.getContract("CaskSubscriptionPlans");
    const subscriptions = await hre.ethers.getContract("CaskSubscriptions");
    const defaultProxyAdmin = await hre.ethers.getContract("DefaultProxyAdmin");

    //
    // Protocol Addresses
    //
    console.log("\nProtocol Contract addresses");
    console.log("====================");

    console.log(`CaskVaultAdmin:                         ${vaultAdmin.address}`);
    console.log(`CaskVaultAdmin Proxy Admin:             ${await hre.upgrades.erc1967.getAdminAddress(vaultAdmin.address)}`);
    console.log(`CaskVaultAdmin Impl:                    ${await hre.upgrades.erc1967.getImplementationAddress(vaultAdmin.address)}`);
    console.log(`CaskVaultAdmin Owner:                   ${await vaultAdmin.owner()}`);

    console.log(`CaskVault:                              ${vault.address}`);
    console.log(`CaskVault Proxy Admin:                  ${await hre.upgrades.erc1967.getAdminAddress(vault.address)}`);
    console.log(`CaskVault Impl:                         ${await hre.upgrades.erc1967.getImplementationAddress(vault.address)}`);
    console.log(`CaskVault Owner:                        ${await vault.owner()}`);

    console.log(`CaskSubscriptionPlans:                  ${subscriptionPlans.address}`);
    console.log(`CaskSubscriptionPlans Proxy Admin:      ${await hre.upgrades.erc1967.getAdminAddress(subscriptionPlans.address)}`);
    console.log(`CaskSubscriptionPlans Impl:             ${await hre.upgrades.erc1967.getImplementationAddress(subscriptionPlans.address)}`);
    console.log(`CaskSubscriptionPlans Owner:            ${await subscriptionPlans.owner()}`);

    console.log(`CaskSubscriptions:                      ${subscriptions.address}`);
    console.log(`CaskSubscriptions Proxy Admin:          ${await hre.upgrades.erc1967.getAdminAddress(subscriptions.address)}`);
    console.log(`CaskSubscriptions Impl:                 ${await hre.upgrades.erc1967.getImplementationAddress(subscriptions.address)}`);
    console.log(`CaskSubscriptions Owner:                ${await subscriptions.owner()}`);

    console.log(`DefaultProxyAdmin:                      ${defaultProxyAdmin.address}`);
    console.log(`DefaultProxyAdmin Owner:                ${await defaultProxyAdmin.owner()}`);

    //
    // Config
    //
    const paymentFeeFixed = await subscriptions.paymentFeeFixed();
    const paymentFeeRate = await subscriptions.paymentFeeRate();

    console.log("\nProtocol Configuration");
    console.log("====================");
    console.log(`CaskVaultAdmin vault:                   ${await vaultAdmin.vault()}`);
    console.log(`CaskVaultAdmin strategist:              ${await vaultAdmin.strategist()}`);
    console.log(`CaskVault baseAsset:                    ${await vault.getBaseAsset()}`);
    console.log(`CaskVault vaultAdmin:                   ${await vault.vaultAdmin()}`);
    const operatorCount = await vault.operatorCount();
    console.log(`CaskVault operatorCount:                ${operatorCount}`);
    for (let i = 0; i < operatorCount; i++) {
        console.log(`   operator ${i}:                          ${await vault.operators(i)}`);
    }
    console.log(`CaskSubscriptionPlans protocol:         ${await subscriptionPlans.protocol()}`);
    console.log(`CaskSubscriptions vault:                ${await subscriptions.vault()}`);
    console.log(`CaskSubscriptions subscriptionPlans:    ${await subscriptions.subscriptionPlans()}`);
    console.log(`CaskSubscriptions paymentFeeFixed:      ${paymentFeeFixed}`);
    console.log(`CaskSubscriptions paymentFeeRate:       ${paymentFeeRate} (${paymentFeeRate / 100}%)`);


    //
    // Vault
    //
    console.log("\nVault");
    console.log("====================");
    console.log(`paused:                                 ${await vault.paused()}`);
    console.log(`totalSupply:                            ${await vault.totalSupply()}`);
    const allAssets = await vault.getAllAssets();
    console.log(`allowedAssets count:                    ${allAssets.length}`);
    for (let i = 0; i < allAssets.length; i++) {
        const assetInfo = await vault.getAsset(allAssets[i]);
        const assetBalance = await vault.totalAssetBalance(allAssets[i]);
        console.log(`Asset ${allAssets[i]}:     Balance: ${assetBalance}`)
    }


}


/**
 * Prints information about deployed contracts and their config.
 */
async function debug(taskArguments, hre) {


    const isFork = process.env.FORK === "true";
    const isLocalhost = !isFork && hre.network.name === "localhost";
    const isMemnet = hre.network.name === "hardhat";

    const isKovan = hre.network.name === "kovan";
    const isMainnet = hre.network.name === "mainnet";

    const isPolygon = hre.network.name === "polygon";
    const isMumbai = hre.network.name === "mumbai";

    const isTest = process.env.IS_TEST === "true";

    const isDevnet = isLocalhost || isMemnet;
    const isTestnet = isKovan || isMumbai;
    const isProdnet = isMainnet || isPolygon;
    const isRealChain = !isLocalhost && !isMemnet;
    const isDaoChain = isMemnet || isFork || isLocalhost || isMainnet || isKovan;
    const isProtocolChain = isMemnet || isFork || isLocalhost || isPolygon || isMumbai;


    await _debug_core(taskArguments, hre);

    if (isDaoChain) {
        await _debug_dao(taskArguments, hre);
    }

    if (isProtocolChain) {
        await _debug_protocol(taskArguments, hre);
    }

}

module.exports = {
    debug,
};
