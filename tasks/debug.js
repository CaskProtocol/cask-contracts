const { parseUnits, formatUnits } = require("ethers").utils;
const { CaskSDK } = require('@caskprotocol/sdk');

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
async function _debug_vault(taskArguments, hre) {
    const vault = await hre.ethers.getContract("CaskVault");

    //
    // Vault Addresses
    //
    console.log("\nVault Contract addresses");
    console.log("====================");
    console.log(`CaskVault:                                      ${vault.address}`);
    console.log(`CaskVault Proxy Admin:                          ${await hre.upgrades.erc1967.getAdminAddress(vault.address)}`);
    console.log(`CaskVault Impl:                                 ${await hre.upgrades.erc1967.getImplementationAddress(vault.address)}`);
    console.log(`CaskVault Owner:                                ${await vault.owner()}`);

    const baseAsset = await vault.getBaseAsset();
    const baseAssetInfo = await vault.getAsset(baseAsset);
    const baseAssetContract = CaskSDK.contracts.ERC20({tokenAddress: baseAsset, provider: hre.ethers.provider});
    const baseAssetSymbol = await baseAssetContract.symbol();

    //
    // Vault Config
    //
    console.log("\nVault Configuration");
    console.log("====================");
    console.log(`paused:                                         ${await vault.paused()}`);
    console.log(`baseAsset:                                      ${baseAsset} (${baseAssetSymbol})`);
    console.log(`baseAsset decimals:                             ${baseAssetInfo.assetDecimals}`);
    console.log(`feeDistributor:                                 ${await vault.feeDistributor()}`);
    const protocolCount = await vault.protocolCount();
    console.log(`CaskVault protocolCount:                        ${protocolCount}`);
    for (let i = 0; i < protocolCount; i++) {
        console.log(`   protocol ${i}:                                  ${await vault.protocols(i)}`);
    }
    console.log(`minDeposit:                                     ${formatUnits(await vault.minDeposit(), baseAssetInfo.assetDecimals)}`);
    console.log(`maxPriceFeedAge:                                ${await vault.maxPriceFeedAge()}`);
    console.log(`totalSupply:                                    ${await vault.totalSupply()}`);
    console.log(`totalValue:                                     ${formatUnits(await vault.totalValue(), baseAssetInfo.assetDecimals)}`);
    console.log(`pricePerShare:                                  ${await vault.pricePerShare()}`);

    const allAssets = await vault.getAllAssets();
    console.log(`allowedAssets count:                            ${allAssets.length}`);
    for (let i = 0; i < allAssets.length; i++) {
        const assetInfo = await vault.getAsset(allAssets[i]);
        const assetBalance = await vault.totalAssetBalance(allAssets[i]);

        const assetContract = CaskSDK.contracts.ERC20({tokenAddress: allAssets[i], provider: hre.ethers.provider});
        const symbol = await assetContract.symbol();

        console.log(`Asset ${allAssets[i]}`);
        console.log(`   Symbol                                       ${symbol}`);
        console.log(`   Allowed:                                     ${assetInfo.allowed}`);
        console.log(`   Balance:                                     ${formatUnits(assetBalance, assetInfo.assetDecimals)}`);
        if (assetInfo.depositLimit.toHexString() === '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') {
            console.log(`   Deposit Limit:                               Unlimited`);
        } else {
            console.log(`   Deposit Limit:                               ${formatUnits(assetInfo.depositLimit, assetInfo.assetDecimals)}`);
        }
        console.log(`   Oracle:                                      ${assetInfo.priceFeed}`);
        console.log(`   Slippage:                                    ${assetInfo.slippageBps} bps (${assetInfo.slippageBps / 100}%)`);
    }
}

async function _debug_subscriptions(taskArguments, hre) {

    const vault = await hre.ethers.getContract("CaskVault");
    const subscriptionPlans = await hre.ethers.getContract("CaskSubscriptionPlans");
    const subscriptions = await hre.ethers.getContract("CaskSubscriptions");
    const subscriptionManager = await hre.ethers.getContract("CaskSubscriptionManager");
    const defaultProxyAdmin = await hre.ethers.getContract("DefaultProxyAdmin");
    const baseAsset = await vault.getBaseAsset();
    const baseAssetInfo = await vault.getAsset(baseAsset);
    const baseAssetContract = CaskSDK.contracts.ERC20({tokenAddress: baseAsset, provider: hre.ethers.provider});
    const baseAssetSymbol = await baseAssetContract.symbol();

    //
    // Protocol Addresses
    //
    console.log("\nSubscription Contract addresses");
    console.log("====================");
    console.log(`CaskSubscriptionPlans:                          ${subscriptionPlans.address}`);
    console.log(`CaskSubscriptionPlans Proxy Admin:              ${await hre.upgrades.erc1967.getAdminAddress(subscriptionPlans.address)}`);
    console.log(`CaskSubscriptionPlans Impl:                     ${await hre.upgrades.erc1967.getImplementationAddress(subscriptionPlans.address)}`);
    console.log(`CaskSubscriptionPlans Owner:                    ${await subscriptionPlans.owner()}`);

    console.log(`CaskSubscriptions:                              ${subscriptions.address}`);
    console.log(`CaskSubscriptions Proxy Admin:                  ${await hre.upgrades.erc1967.getAdminAddress(subscriptions.address)}`);
    console.log(`CaskSubscriptions Impl:                         ${await hre.upgrades.erc1967.getImplementationAddress(subscriptions.address)}`);
    console.log(`CaskSubscriptions Owner:                        ${await subscriptions.owner()}`);

    console.log(`CaskSubscriptionManager:                        ${subscriptionManager.address}`);
    console.log(`CaskSubscriptionManager Proxy Admin:            ${await hre.upgrades.erc1967.getAdminAddress(subscriptionManager.address)}`);
    console.log(`CaskSubscriptionManager Impl:                   ${await hre.upgrades.erc1967.getImplementationAddress(subscriptionManager.address)}`);
    console.log(`CaskSubscriptionManager Owner:                  ${await subscriptionManager.owner()}`);

    console.log(`DefaultProxyAdmin:                              ${defaultProxyAdmin.address}`);
    console.log(`DefaultProxyAdmin Owner:                        ${await defaultProxyAdmin.owner()}`);


    //
    // Protocol Config
    //
    const paymentMinValue = await subscriptionManager.paymentMinValue();
    const paymentFeeMin = await subscriptionManager.paymentFeeMin();
    const paymentFeeRateMin = await subscriptionManager.paymentFeeRateMin();
    const paymentFeeRateMax = await subscriptionManager.paymentFeeRateMax();

    console.log("\nSubscription Configuration");
    console.log("====================");
    console.log(`CaskSubscriptions subscriptionManager:          ${await subscriptions.subscriptionManager()}`);
    console.log(`CaskSubscriptions subscriptionPlans:            ${await subscriptions.subscriptionPlans()}`);

    console.log(`CaskSubscriptionPlans subscriptionManager:      ${await subscriptionPlans.subscriptionManager()}`);
    console.log(`CaskSubscriptionPlans subscriptions:            ${await subscriptionPlans.subscriptions()}`);

    console.log(`CaskSubscriptionManagers vault:                 ${await subscriptionManager.vault()}`);
    console.log(`CaskSubscriptionManagers subscriptionPlans:     ${await subscriptionManager.subscriptionPlans()}`);
    console.log(`CaskSubscriptionManagers subscriptions:         ${await subscriptionManager.subscriptions()}`);
    console.log(`CaskSubscriptionManagers paymentMinValue:       ${paymentMinValue} (${formatUnits(paymentMinValue, baseAssetInfo.assetDecimals)} ${baseAssetSymbol})`);
    console.log(`CaskSubscriptionManagers paymentFeeMin:         ${paymentFeeMin} (${formatUnits(paymentFeeMin, baseAssetInfo.assetDecimals)} ${baseAssetSymbol})`);
    console.log(`CaskSubscriptionManagers paymentFeeRateMin:     ${paymentFeeRateMin} bps (${paymentFeeRateMin / 100}%)`);
    console.log(`CaskSubscriptionManagers paymentFeeRateMax:     ${paymentFeeRateMax} bps (${paymentFeeRateMax / 100}%)`);
    console.log(`CaskSubscriptionManagers stakeTargetFactor:     ${await subscriptionManager.stakeTargetFactor()}`);
    console.log(`CaskSubscriptionManagers processBucketSize:     ${await subscriptionManager.processBucketSize()} seconds`);
    console.log(`CaskSubscriptionManagers processBucketMaxAge:   ${await subscriptionManager.processBucketMaxAge()} seconds`);
    console.log(`CaskSubscriptionManagers paymentRetryDelay:     ${await subscriptionManager.paymentRetryDelay()} seconds`);

    const now = new Date().getTime() / 1000;
    const activeQueuePos = await subscriptionManager.queuePosition(1);
    const activeQueueSize = await subscriptionManager.queueSize(1, activeQueuePos);
    const pastDueQueuePos = await subscriptionManager.queuePosition(2);
    const pastdueQueueSize = await subscriptionManager.queueSize(2, pastDueQueuePos);

    console.log("\nSubscription Queue");
    console.log("====================");
    console.log(`CaskSubscriptionManagers active queuePosition:  ${new Date(activeQueuePos*1000).toISOString()} (${parseInt(now - activeQueuePos)} seconds old)`);
    console.log(`CaskSubscriptionManagers active queueSize:      ${activeQueueSize}`);
    console.log(`CaskSubscriptionManagers pastdue queuePosition: ${new Date(pastDueQueuePos*1000).toISOString()} (${parseInt(now - pastDueQueuePos)} seconds old)`);
    console.log(`CaskSubscriptionManagers pastdue queueSize:     ${pastdueQueueSize}`);

}

async function _debug_dca(taskArguments, hre) {

    const vault = await hre.ethers.getContract("CaskVault");
    const dca = await hre.ethers.getContract("CaskDCA");
    const dcaManager = await hre.ethers.getContract("CaskDCAManager");
    const defaultProxyAdmin = await hre.ethers.getContract("DefaultProxyAdmin");
    const baseAsset = await vault.getBaseAsset();
    const baseAssetInfo = await vault.getAsset(baseAsset);
    const baseAssetContract = CaskSDK.contracts.ERC20({tokenAddress: baseAsset, provider: hre.ethers.provider});
    const baseAssetSymbol = await baseAssetContract.symbol();

    //
    // Protocol Addresses
    //
    console.log("\nDCA Contract addresses");
    console.log("====================");
    console.log(`CaskDCA:                                        ${dca.address}`);
    console.log(`CaskDCA Proxy Admin:                            ${await hre.upgrades.erc1967.getAdminAddress(dca.address)}`);
    console.log(`CaskDCA Impl:                                   ${await hre.upgrades.erc1967.getImplementationAddress(dca.address)}`);
    console.log(`CaskDCA Owner:                                  ${await dca.owner()}`);

    console.log(`CaskDCAManager:                                 ${dcaManager.address}`);
    console.log(`CaskDCAManager Proxy Admin:                     ${await hre.upgrades.erc1967.getAdminAddress(dcaManager.address)}`);
    console.log(`CaskDCAManager Impl:                            ${await hre.upgrades.erc1967.getImplementationAddress(dcaManager.address)}`);
    console.log(`CaskDCAManager Owner:                           ${await dcaManager.owner()}`);

    console.log(`DefaultProxyAdmin:                              ${defaultProxyAdmin.address}`);
    console.log(`DefaultProxyAdmin Owner:                        ${await defaultProxyAdmin.owner()}`);

    //
    // DCA Config
    //
    const minAmount = await dca.minAmount();
    const minPeriod = await dca.minPeriod();
    const minSlippage = await dca.minSlippage();

    const maxSkips = await dcaManager.maxSkips();
    const dcaFeeBps = await dcaManager.dcaFeeBps();
    const dcaFeeMin = await dcaManager.dcaFeeMin();
    const dcaMinValue = await dcaManager.dcaMinValue();
    const maxPriceFeedAge = await dcaManager.maxPriceFeedAge();
    const queueBucketSize = await dcaManager.queueBucketSize();
    const maxQueueAge = await dcaManager.maxQueueAge();


    console.log("\nDCA Configuration");
    console.log("====================");
    console.log(`CaskDCA dcaManager:                             ${await dca.dcaManager()}`);
    console.log(`CaskDCA assetsMerkleRoot:                       ${await dca.assetsMerkleRoot()}`);
    console.log(`CaskDCA minAmount:                              ${minAmount} (${formatUnits(minAmount, baseAssetInfo.assetDecimals)} ${baseAssetSymbol})`);
    console.log(`CaskDCA minPeriod:                              ${minPeriod} seconds`);
    console.log(`CaskDCA minSlippage:                            ${minSlippage} bps (${minSlippage / 100}%)`);

    console.log(`CaskDCAManager caskVault:                       ${await dcaManager.caskVault()}`);
    console.log(`CaskDCAManager caskDCA:                         ${await dcaManager.caskDCA()}`);
    console.log(`CaskDCAManager feeDistributor:                  ${await dcaManager.feeDistributor()}`);
    console.log(`CaskDCAManager maxSkips:                        ${maxSkips}`);
    console.log(`CaskDCAManager dcaFeeBps:                       ${dcaFeeBps} bps (${dcaFeeBps / 100}%)`);
    console.log(`CaskDCAManager dcaFeeMin:                       ${dcaFeeMin} (${formatUnits(dcaFeeMin, baseAssetInfo.assetDecimals)} ${baseAssetSymbol})`);
    console.log(`CaskDCAManager dcaMinValue:                     ${dcaMinValue} (${formatUnits(dcaMinValue, baseAssetInfo.assetDecimals)} ${baseAssetSymbol})`);
    console.log(`CaskDCAManager maxPriceFeedAge:                 ${maxPriceFeedAge} seconds`);
    console.log(`CaskDCAManager queueBucketSize:                 ${queueBucketSize}`);
    console.log(`CaskDCAManager maxQueueAge:                     ${maxQueueAge}`);

    const now = new Date().getTime() / 1000;
    const queuePos = await dcaManager.queuePosition(1);
    const queueSize = await dcaManager.queueSize(1, queuePos);

    console.log("\nDCA Queue");
    console.log("====================");
    console.log(`CaskDCAManager queuePosition:                   ${new Date(queuePos*1000).toISOString()} (${parseInt(now - queuePos)} seconds old)`);
    console.log(`CaskDCAManager queueSize:                       ${queueSize}`);

}

async function _debug_p2p(taskArguments, hre) {

    const vault = await hre.ethers.getContract("CaskVault");
    const p2p = await hre.ethers.getContract("CaskP2P");
    const p2pManager = await hre.ethers.getContract("CaskP2PManager");
    const defaultProxyAdmin = await hre.ethers.getContract("DefaultProxyAdmin");
    const baseAsset = await vault.getBaseAsset();
    const baseAssetInfo = await vault.getAsset(baseAsset);
    const baseAssetContract = CaskSDK.contracts.ERC20({tokenAddress: baseAsset, provider: hre.ethers.provider});
    const baseAssetSymbol = await baseAssetContract.symbol();

    //
    // Protocol Addresses
    //
    console.log("\nP2P Contract addresses");
    console.log("====================");
    console.log(`CaskP2P:                                        ${p2p.address}`);
    console.log(`CaskP2P Proxy Admin:                            ${await hre.upgrades.erc1967.getAdminAddress(p2p.address)}`);
    console.log(`CaskP2P Impl:                                   ${await hre.upgrades.erc1967.getImplementationAddress(p2p.address)}`);
    console.log(`CaskP2P Owner:                                  ${await p2p.owner()}`);

    console.log(`CaskP2PManager:                                 ${p2pManager.address}`);
    console.log(`CaskP2PManager Proxy Admin:                     ${await hre.upgrades.erc1967.getAdminAddress(p2pManager.address)}`);
    console.log(`CaskP2PManager Impl:                            ${await hre.upgrades.erc1967.getImplementationAddress(p2pManager.address)}`);
    console.log(`CaskP2PManager Owner:                           ${await p2pManager.owner()}`);

    console.log(`DefaultProxyAdmin:                              ${defaultProxyAdmin.address}`);
    console.log(`DefaultProxyAdmin Owner:                        ${await defaultProxyAdmin.owner()}`);

    //
    // P2P Config
    //
    const minAmount = await p2p.minAmount();
    const minPeriod = await p2p.minPeriod();

    const maxSkips = await p2pManager.maxSkips();
    const paymentFee = await p2pManager.paymentFee();
    const queueBucketSize = await p2pManager.queueBucketSize();
    const maxQueueAge = await p2pManager.maxQueueAge();


    console.log("\nP2P Configuration");
    console.log("====================");
    console.log(`CaskP2P p2pManager:                             ${await p2p.p2pManager()}`);
    console.log(`CaskP2P minAmount:                              ${minAmount} (${formatUnits(minAmount, baseAssetInfo.assetDecimals)} ${baseAssetSymbol})`);
    console.log(`CaskP2P minPeriod:                              ${minPeriod} seconds`);

    console.log(`CaskP2PManager caskVault:                       ${await p2pManager.caskVault()}`);
    console.log(`CaskP2PManager caskP2P:                         ${await p2pManager.caskP2P()}`);
    console.log(`CaskP2PManager maxSkips:                        ${maxSkips}`);
    console.log(`CaskP2PManager paymentFee:                      ${paymentFee} (${formatUnits(paymentFee, baseAssetInfo.assetDecimals)} ${baseAssetSymbol})`);
    console.log(`CaskP2PManager queueBucketSize:                 ${queueBucketSize}`);
    console.log(`CaskP2PManager maxQueueAge:                     ${maxQueueAge}`);

    const now = new Date().getTime() / 1000;
    const queuePos = await p2pManager.queuePosition(1);
    const queueSize = await p2pManager.queueSize(1, queuePos);

    console.log("\nP2P Queue");
    console.log("====================");
    console.log(`CaskP2PManager queuePosition:                   ${new Date(queuePos*1000).toISOString()} (${parseInt(now - queuePos)} seconds old)`);
    console.log(`CaskP2PManager queueSize:                       ${queueSize}`);

}

async function _debug_chainlinkTopup(taskArguments, hre) {

    const vault = await hre.ethers.getContract("CaskVault");
    const cltu = await hre.ethers.getContract("CaskChainlinkTopup");
    const cltuManager = await hre.ethers.getContract("CaskChainlinkTopupManager");
    const defaultProxyAdmin = await hre.ethers.getContract("DefaultProxyAdmin");
    const linkBridgeToken = await cltuManager.linkBridgeToken();
    const linkFundingToken = await cltuManager.linkFundingToken();
    const linkPriceFeed = await cltuManager.linkPriceFeed();
    const linkSwapPathIn = await cltuManager.linkSwapPath(0);
    const linkSwapPathOut = await cltuManager.linkSwapPath(1);
    const linkSwapRouter = await cltuManager.linkSwapRouter();
    const pegswap = await cltuManager.pegswap();

    const baseAsset = await vault.getBaseAsset();
    const baseAssetInfo = await vault.getAsset(baseAsset);
    const baseAssetContract = CaskSDK.contracts.ERC20({tokenAddress: baseAsset, provider: hre.ethers.provider});
    const baseAssetSymbol = await baseAssetContract.symbol();

    //
    // Protocol Addresses
    //
    console.log("\nChainlinkTopup Contract addresses");
    console.log("====================");
    console.log(`CaskChainlinkTopup:                                    ${cltu.address}`);
    console.log(`CaskChainlinkTopup Proxy Admin:                        ${await hre.upgrades.erc1967.getAdminAddress(cltu.address)}`);
    console.log(`CaskChainlinkTopup Impl:                               ${await hre.upgrades.erc1967.getImplementationAddress(cltu.address)}`);
    console.log(`CaskChainlinkTopup Owner:                              ${await cltu.owner()}`);

    console.log(`CaskChainlinkTopupManager:                             ${cltuManager.address}`);
    console.log(`CaskChainlinkTopupManager Proxy Admin:                 ${await hre.upgrades.erc1967.getAdminAddress(cltuManager.address)}`);
    console.log(`CaskChainlinkTopupManager Impl:                        ${await hre.upgrades.erc1967.getImplementationAddress(cltuManager.address)}`);
    console.log(`CaskChainlinkTopupManager Owner:                       ${await cltuManager.owner()}`);

    console.log(`DefaultProxyAdmin:                                     ${defaultProxyAdmin.address}`);
    console.log(`DefaultProxyAdmin Owner:                               ${await defaultProxyAdmin.owner()}`);

    //
    // ChainlinkTopup Config
    //
    const currentGroup = await cltu.currentGroup();
    const minTopupAmount = await cltu.minTopupAmount();
    const groupSize = await cltu.groupSize();

    const maxSkips = await cltuManager.maxSkips();
    const topupFeeBps = await cltuManager.topupFeeBps();
    const topupFeeMin = await cltuManager.topupFeeMin();
    const maxPriceFeedAge = await cltuManager.maxPriceFeedAge();
    const maxTopupsPerGroupRun = await cltuManager.maxTopupsPerGroupRun();
    const maxSwapSlippageBps = await cltuManager.maxSwapSlippageBps();
    const feeDistributor = await cltuManager.feeDistributor();
    const queueBucketSize = await cltuManager.queueBucketSize();
    const maxQueueAge = await cltuManager.maxQueueAge();


    console.log("\nChainlinkTopup Configuration");
    console.log("====================");
    console.log(`CaskChainlinkTopup chainlinkTopupManager:                  ${await cltu.chainlinkTopupManager()}`);
    console.log(`CaskChainlinkTopup currentGroup:                           ${currentGroup}`);
    console.log(`CaskChainlinkTopup minTopupAmount:                         ${minTopupAmount} (${formatUnits(minTopupAmount, baseAssetInfo.assetDecimals)} ${baseAssetSymbol})`);
    console.log(`CaskChainlinkTopup groupSize:                              ${groupSize}`);

    console.log(`CaskChainlinkTopupManager caskVault:                       ${await cltuManager.caskVault()}`);
    console.log(`CaskChainlinkTopupManager caskChainlinkTopup:              ${await cltuManager.caskChainlinkTopup()}`);
    console.log(`CaskChainlinkTopupManager maxSkips:                        ${maxSkips}`);
    console.log(`CaskChainlinkTopupManager topupFeeBps:                     ${topupFeeBps} bps (${topupFeeBps / 100}%)`);
    console.log(`CaskChainlinkTopupManager topupFeeMin:                     ${topupFeeMin} (${formatUnits(topupFeeMin, baseAssetInfo.assetDecimals)} ${baseAssetSymbol})`);
    console.log(`CaskChainlinkTopupManager maxPriceFeedAge:                 ${maxPriceFeedAge} seconds`);
    console.log(`CaskChainlinkTopupManager maxTopupsPerGroupRun:            ${maxTopupsPerGroupRun}`);
    console.log(`CaskChainlinkTopupManager maxSwapSlippageBps:              ${maxSwapSlippageBps} bps (${maxSwapSlippageBps / 100}%)`);
    console.log(`CaskChainlinkTopupManager feeDistributor:                  ${feeDistributor}`);
    console.log(`CaskChainlinkTopupManager queueBucketSize:                 ${queueBucketSize}`);
    console.log(`CaskChainlinkTopupManager maxQueueAge:                     ${maxQueueAge}`);

    const now = new Date().getTime() / 1000;
    const queuePos = await cltuManager.queuePosition(1);
    const queueSize = await cltuManager.queueSize(1, queuePos);

    console.log("\nChainlinkTopupManager Queue");
    console.log("====================");
    console.log(`CaskChainlinkTopupManager queuePosition:                   ${new Date(queuePos*1000).toISOString()} (${parseInt(now - queuePos)} seconds old)`);
    console.log(`CaskChainlinkTopupManager queueSize:                       ${queueSize}`);

}


/**
 * Prints information about deployed contracts and their config.
 */
async function debug(taskArguments, hre, protocol='all') {
    const {
        isDaoChain,
        isProtocolChain,
    } = require("../test/_networks");

    if (isDaoChain) {
        await _debug_core(taskArguments, hre);
        await _debug_dao(taskArguments, hre);
    }

    if (isProtocolChain) {
        if (protocol === 'all' || protocol === 'vault') {
            await _debug_vault(taskArguments, hre);
        }
        if (protocol === 'all' || protocol === 'subscriptions') {
            await _debug_subscriptions(taskArguments, hre);
        }
        if (protocol === 'all' || protocol === 'dca') {
            await _debug_dca(taskArguments, hre);
        }
        if (protocol === 'all' || protocol === 'p2p') {
            await _debug_p2p(taskArguments, hre);
        }
        if (protocol === 'all' || protocol === 'chainlinkTopup') {
            await _debug_chainlinkTopup(taskArguments, hre);
        }
    }
}

module.exports = {
    debug,
};
