const { parseUnits, formatUnits } = require("ethers").utils;

function caskUnits(amount) {
    return parseUnits(amount, 18);
}

function caskUnitsFormat(amount) {
    return formatUnits(amount, 18);
}

async function _debug_core(taskArguments, hre) {

    const caskToken = await hre.ethers.getContract("CaskToken");

    //
    // Core Addresses
    //
    console.log("\nCore Contract addresses");
    console.log("====================");

    console.log(`CASK Token:                                     ${caskToken.address}`);
    console.log(`CASK totalSupply:                               ${caskUnitsFormat(await caskToken.totalSupply())}`);

}

async function _debug_dao(taskArguments, hre) {

    const caskToken = await hre.ethers.getContract("CaskToken");
    const caskTreasury = await hre.ethers.getContract("CaskTreasury");
    const treasuryVestedEscrow = await hre.ethers.getContract("TreasuryVestedEscrow");
    const teamVestedEscrow = await hre.ethers.getContract("TeamVestedEscrow");
    const investorVestedEscrow = await hre.ethers.getContract("InvestorVestedEscrow");

    //
    // DAO Addresses
    //
    console.log("\nDAO Contract addresses");
    console.log("====================");

    console.log(`CaskTreasury:                                   ${caskTreasury.address}`);
    console.log(`CaskTreasury Owner:                             ${await caskTreasury.owner()}`);
    console.log(`CaskTreasury CASK Balance:                      ${caskUnitsFormat(await caskToken.balanceOf(caskTreasury.address))}`);

    console.log(`\nTreasuryVestedEscrow:                           ${treasuryVestedEscrow.address}`);
    console.log(`TreasuryVestedEscrow CASK Balance:              ${caskUnitsFormat(await caskToken.balanceOf(treasuryVestedEscrow.address))}`);
    console.log(`TreasuryVestedEscrow Admin:                     ${await treasuryVestedEscrow.admin()}`);
    console.log(`TreasuryVestedEscrow FundAdmin:                 ${await treasuryVestedEscrow.fundAdmin()}`);
    console.log(`TreasuryVestedEscrow initialLockedSupply:       ${caskUnitsFormat(await treasuryVestedEscrow.initialLockedSupply())}`);
    console.log(`TreasuryVestedEscrow unallocatedSupply:         ${caskUnitsFormat(await treasuryVestedEscrow.unallocatedSupply())}`);
    console.log(`TreasuryVestedEscrow vestedSupply:              ${caskUnitsFormat(await treasuryVestedEscrow.vestedSupply())}`);
    console.log(`TreasuryVestedEscrow lockedSupply:              ${caskUnitsFormat(await treasuryVestedEscrow.lockedSupply())}`);

    console.log(`\nTeamVestedEscrow:                               ${teamVestedEscrow.address}`);
    console.log(`TeamVestedEscrow CASK Balance:                  ${caskUnitsFormat(await caskToken.balanceOf(teamVestedEscrow.address))}`);
    console.log(`TeamVestedEscrow Admin:                         ${await teamVestedEscrow.admin()}`);
    console.log(`TeamVestedEscrow FundAdmin:                     ${await teamVestedEscrow.fundAdmin()}`);
    console.log(`TeamVestedEscrow initialLockedSupply:           ${caskUnitsFormat(await teamVestedEscrow.initialLockedSupply())}`);
    console.log(`TeamVestedEscrow unallocatedSupply:             ${caskUnitsFormat(await teamVestedEscrow.unallocatedSupply())}`);
    console.log(`TeamVestedEscrow vestedSupply:                  ${caskUnitsFormat(await teamVestedEscrow.vestedSupply())}`);
    console.log(`TeamVestedEscrow lockedSupply:                  ${caskUnitsFormat(await teamVestedEscrow.lockedSupply())}`);

    console.log(`\nInvestorVestedEscrow:                           ${investorVestedEscrow.address}`);
    console.log(`InvestorVestedEscrow CASK Balance:              ${caskUnitsFormat(await caskToken.balanceOf(investorVestedEscrow.address))}`);
    console.log(`InvestorVestedEscrow Admin:                     ${await investorVestedEscrow.admin()}`);
    console.log(`InvestorVestedEscrow FundAdmin:                 ${await investorVestedEscrow.fundAdmin()}`);
    console.log(`InvestorVestedEscrow initialLockedSupply:       ${caskUnitsFormat(await investorVestedEscrow.initialLockedSupply())}`);
    console.log(`InvestorVestedEscrow unallocatedSupply:         ${caskUnitsFormat(await investorVestedEscrow.unallocatedSupply())}`);
    console.log(`InvestorVestedEscrow vestedSupply:              ${caskUnitsFormat(await investorVestedEscrow.vestedSupply())}`);
    console.log(`InvestorVestedEscrow lockedSupply:              ${caskUnitsFormat(await investorVestedEscrow.lockedSupply())}`);

}

async function _debug_protocol(taskArguments, hre) {

    const vaultManager = await hre.ethers.getContract("CaskVaultManager");
    const vault = await hre.ethers.getContract("CaskVault");
    const subscriptionPlans = await hre.ethers.getContract("CaskSubscriptionPlans");
    const subscriptions = await hre.ethers.getContract("CaskSubscriptions");
    const subscriptionManager = await hre.ethers.getContract("CaskSubscriptionManager");
    const defaultProxyAdmin = await hre.ethers.getContract("DefaultProxyAdmin");

    //
    // Protocol Addresses
    //
    console.log("\nProtocol Contract addresses");
    console.log("====================");

    console.log(`CaskVaultManager:                               ${vaultManager.address}`);
    console.log(`CaskVaultManager Proxy Admin:                   ${await hre.upgrades.erc1967.getAdminAddress(vaultManager.address)}`);
    console.log(`CaskVaultManager Impl:                          ${await hre.upgrades.erc1967.getImplementationAddress(vaultManager.address)}`);
    console.log(`CaskVaultManager Owner:                         ${await vaultManager.owner()}`);

    console.log(`CaskVault:                                      ${vault.address}`);
    console.log(`CaskVault Proxy Admin:                          ${await hre.upgrades.erc1967.getAdminAddress(vault.address)}`);
    console.log(`CaskVault Impl:                                 ${await hre.upgrades.erc1967.getImplementationAddress(vault.address)}`);
    console.log(`CaskVault Owner:                                ${await vault.owner()}`);

    console.log(`CaskSubscriptionPlans:                          ${subscriptionPlans.address}`);
    console.log(`CaskSubscriptionPlans Proxy Admin:              ${await hre.upgrades.erc1967.getAdminAddress(subscriptionPlans.address)}`);
    console.log(`CaskSubscriptionPlans Impl:                     ${await hre.upgrades.erc1967.getImplementationAddress(subscriptionPlans.address)}`);
    console.log(`CaskSubscriptionPlans Owner:                    ${await subscriptionPlans.owner()}`);

    console.log(`CaskSubscriptions:                              ${subscriptions.address}`);
    console.log(`CaskSubscriptions Proxy Admin:                  ${await hre.upgrades.erc1967.getAdminAddress(subscriptions.address)}`);
    console.log(`CaskSubscriptions Impl:                         ${await hre.upgrades.erc1967.getImplementationAddress(subscriptions.address)}`);
    console.log(`CaskSubscriptions Owner:                        ${await subscriptions.owner()}`);

    console.log(`DefaultProxyAdmin:                              ${defaultProxyAdmin.address}`);
    console.log(`DefaultProxyAdmin Owner:                        ${await defaultProxyAdmin.owner()}`);


    //
    // Vault Config
    //
    const strategyAllocationRate = await vaultManager.strategyAllocationRate();
    const yieldFeeBps = await vaultManager.yieldFeeBps();
    const strategist = await vaultManager.strategist();

    console.log("\nVault Configuration");
    console.log("====================");
    console.log(`CaskVaultManager strategyAllocationRate:        ${strategyAllocationRate}`);
    console.log(`CaskVaultManager yieldFeeBps:                   ${yieldFeeBps}`);
    console.log(`CaskVaultManager strategist:                    ${strategist}`);
    console.log(`CaskVaultManager vault:                         ${await vaultManager.vault()}`);
    console.log(`CaskVault vaultManager:                         ${await vault.vaultManager()}`);
    console.log(`CaskVault baseAsset:                            ${await vault.getBaseAsset()}`);
    const operatorCount = await vault.operatorCount();
    console.log(`CaskVault operatorCount:                        ${operatorCount}`);
    for (let i = 0; i < operatorCount; i++) {
        console.log(`   operator ${i}:                                  ${await vault.operators(i)}`);
    }

    console.log(`paused:                                         ${await vault.paused()}`);
    console.log(`totalSupply:                                    ${await vault.totalSupply()}`);
    const allAssets = await vault.getAllAssets();
    console.log(`allowedAssets count:                            ${allAssets.length}`);
    for (let i = 0; i < allAssets.length; i++) {
        const assetInfo = await vault.getAsset(allAssets[i]);
        const assetBalance = await vault.totalAssetBalance(allAssets[i]);
        console.log(`Asset ${allAssets[i]}:             Balance: ${formatUnits(assetBalance, assetInfo.assetDecimals)}`)
    }


    //
    // Protocol Config
    //
    const paymentFeeFixed = await subscriptionManager.paymentFeeFixed();
    const paymentFeeRateMin = await subscriptionManager.paymentFeeRateMin();
    const paymentFeeRateMax = await subscriptionManager.paymentFeeRateMax();

    console.log("\nProtocol Configuration");
    console.log("====================");
    console.log(`CaskSubscriptions subscriptionManager:          ${await subscriptions.subscriptionManager()}`);
    console.log(`CaskSubscriptions subscriptionPlans:            ${await subscriptions.subscriptionPlans()}`);

    console.log(`CaskSubscriptionPlans subscriptionManager:      ${await subscriptionPlans.subscriptionManager()}`);

    console.log(`CaskSubscriptionManagers vault:                 ${await subscriptionManager.vault()}`);
    console.log(`CaskSubscriptionManagers subscriptionPlans:     ${await subscriptionManager.subscriptionPlans()}`);
    console.log(`CaskSubscriptionManagers subscriptions:         ${await subscriptionManager.subscriptions()}`);
    console.log(`CaskSubscriptionManagers paymentFeeFixed:       ${paymentFeeFixed} (${paymentFeeFixed / 100}%)`);
    console.log(`CaskSubscriptionManagers paymentFeeRateMin:     ${paymentFeeRateMin} (${paymentFeeRateMin / 100}%)`);
    console.log(`CaskSubscriptionManagers paymentFeeRateMax:     ${paymentFeeRateMax} (${paymentFeeRateMax / 100}%)`);
    console.log(`CaskSubscriptionManagers stakeTargetFactor:     ${await subscriptionManager.stakeTargetFactor()}`);

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
