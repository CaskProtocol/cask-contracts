async function keeper(taskArguments, hre) {

    let keeperTarget;
    let keeperWalletPk;

    if (taskArguments.protocol === 'subscription') {
        keeperTarget = await ethers.getContract("CaskSubscriptionManager");
        keeperWalletPk = process.env.SUBSCRIPTION_KEEPER_PK || process.env.KEEPER_PK;
        console.log(`Starting keeper targeting CaskSubscriptionManager at ${keeperTarget.address}`);
    } else if (taskArguments.protocol === 'dca') {
        keeperTarget = await ethers.getContract("CaskDCAManager");
        keeperWalletPk = process.env.DCA_KEEPER_PK || process.env.KEEPER_PK;
        console.log(`Starting keeper targeting CaskDCAManager at ${keeperTarget.address}`);
    } else if (taskArguments.protocol === 'p2p') {
        keeperTarget = await ethers.getContract("CaskP2PManager");
        keeperWalletPk = process.env.P2P_KEEPER_PK || process.env.KEEPER_PK;
        console.log(`Starting keeper targeting CaskP2PManager at ${keeperTarget.address}`);
    } else {
        throw new Error(`Unknown protocol target: ${taskArguments.protocol}`);
    }

    const queues = taskArguments.queue.split(/\s*,\s*/);
    const gasPrice = parseInt(taskArguments.gasPrice) || hre.network.config.gasPrice;

    let keeperWallet;

    if (hre.network.name.includes('testnet_')) {
        keeperWallet = new ethers.Wallet(process.env.TESTNET_KEEPER_PK, hre.ethers.provider);
    } else if (hre.network.name.includes('internal_')) {
        keeperWallet = new ethers.Wallet(process.env.INTERNAL_KEEPER_PK || process.env.TESTNET_KEEPER_PK,
            hre.ethers.provider);
    } else {
        keeperWallet = new ethers.Wallet(keeperWalletPk, hre.ethers.provider);
    }

    const keeperManager = keeperTarget.connect(keeperWallet);

    console.log(`Keeper ${keeperWallet.address} running with limit ${taskArguments.limit} on queue(s) ${queues} using gasPrice ${gasPrice}`)

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
