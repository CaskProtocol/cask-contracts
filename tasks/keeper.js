async function keeper(taskArguments, hre) {

    let keeperTarget;
    if (taskArguments.protocol === 'subscriptions') {
        keeperTarget = await ethers.getContract("CaskSubscriptionManager");
        console.log(`Starting keeper targeting CaskSubscriptionManager at ${keeperTarget.address}`);
    } else if (taskArguments.protocol === 'dca') {
        keeperTarget = await ethers.getContract("CaskDCAManager");
        console.log(`Starting keeper targeting CaskDCAManager at ${keeperTarget.address}`);
    } else if (taskArguments.protocol === 'p2p') {
        keeperTarget = await ethers.getContract("CaskP2PManager");
        console.log(`Starting keeper targeting CaskP2PManager at ${keeperTarget.address}`);
    } else {
        throw new Error(`Unknown protocol target: ${taskArguments.protocol}`);
    }

    const queues = taskArguments.queue.split(/\s*,\s*/);
    const gasPrice = parseInt(taskArguments.gasPrice) || hre.network.config.gasPrice;

    const networkType = hre.network.name.split('_')[0];
    const keeperWalletPk = process.env[`${networkType.toUpperCase()}_${taskArguments.protocol.toUpperCase()}_KEEPER_PK`] ||
        process.env[`${taskArguments.protocol.toUpperCase()}_KEEPER_PK`] ||
        process.env[`KEEPER_PK`];

    let provider = hre.ethers.provider;
    let keeperWallet;

    if (hre.network.name.includes("celo")) {
        const { CeloProvider } = require('@celo-tools/celo-ethers-wrapper')
        const { CeloWallet } = require('@celo-tools/celo-ethers-wrapper')
        provider = new CeloProvider(process.env.CELO_PROVIDER_URL);
        keeperWallet = new CeloWallet(keeperWalletPk, provider);
    } else if (hre.network.name.includes("alfajores")) {
        const { CeloProvider } = require('@celo-tools/celo-ethers-wrapper')
        const { CeloWallet } = require('@celo-tools/celo-ethers-wrapper')
        provider = new CeloProvider(process.env.ALFAJORES_PROVIDER_URL);
        keeperWallet = new CeloWallet(keeperWalletPk, provider);
    } else {
        keeperWallet = new ethers.Wallet(keeperWalletPk, provider);
    }

    console.log(`Keeper ${keeperWallet.address} running with limit ${taskArguments.limit} on queue(s) ${queues} using gasPrice ${gasPrice}`)

    const keeperManager = keeperTarget.connect(keeperWallet);

    while(true) {

        for (let i = 0; i < queues.length; i++) {
            try {
                const queue = queues[i];
                console.log(`Checking for upkeep on queue ${queue}...`);

                const checkData = ethers.utils.defaultAbiCoder.encode(
                    ['uint256', 'uint256', 'uint8'],
                    [
                        parseInt(taskArguments.limit),
                        parseInt(taskArguments.minDepth),
                        parseInt(queue)
                    ]);
                const checkEstimatedGas = await keeperManager.estimateGas.checkUpkeep(checkData);
                if (checkEstimatedGas.gt(taskArguments.gasLimit)) {
                    console.log(`Warning: estimatedGas for checkUpkeep on queue ${queue} is above gasLimit ${taskArguments.gasLimit}`);
                }
                const checkResult = await keeperManager.checkUpkeep(checkData);
                if (checkResult.upkeepNeeded) {
                    console.log(`Upkeep needed on queue ${queue}. Performing upkeep...`);
                    const performEstimatedGas = await keeperManager.estimateGas
                        .performUpkeep(checkResult.performData, {
                            gasLimit: parseInt(taskArguments.gasLimit),
                            gasPrice: typeof(gasPrice) === 'number' ? gasPrice : undefined
                        });
                    if (performEstimatedGas.gt(taskArguments.gasLimit)) {
                        console.log(`Warning: estimatedGas for performUpkeep on queue ${queue} is above gasLimit ${taskArguments.gasLimit}`);
                    }
                    const tx = await keeperManager
                        .performUpkeep(checkResult.performData, {
                            gasLimit: parseInt(taskArguments.gasLimit),
                            gasPrice: typeof(gasPrice) === 'number' ? gasPrice : undefined
                        });
                    const events = (await tx.wait()).events || [];
                    const report = events.find((e) => e.event === "SubscriptionManagerReport" ||
                                                      e.event === "QueueRunReport");
                    if (report) {
                        console.log(`Report: performed ${JSON.stringify(report.args, null, 2)}`);
                    } else {
                        console.log(`Report not detected after keeper run`);
                    }
                    console.log(`Upkeep complete for queue ${queue}: txn ${tx.hash}`);
                } else {
                    console.log(`No upkeep needed on queue ${queue}.`);
                }
            } catch (err) {
                console.error(`Keeper error: ${err.toString()}`);
            }
        }

        await new Promise(r => setTimeout(() => r(), parseInt(taskArguments.interval)));
    }
}


module.exports = {
    keeper,
};
