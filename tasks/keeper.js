async function keeper(taskArguments, hre) {

    const subscriptionManager = await ethers.getContract("CaskSubscriptionManager");
    const queues = taskArguments.queue.split(/\s*,\s*/);

    const gasPrice = taskArguments.gasPrice || hre.network.config.gasPrice;

    let keeperWallet;

    if (hre.network.name.includes('testnet_')) {
        keeperWallet = new ethers.Wallet(process.env.TESTNET_KEEPER_PK, hre.ethers.provider);
    } else if (hre.network.name.includes('internal_')) {
        keeperWallet = new ethers.Wallet(process.env.INTERNAL_KEEPER_PK || process.env.TESTNET_KEEPER_PK,
            hre.ethers.provider);
    } else {
        keeperWallet = new ethers.Wallet(process.env.KEEPER_PK, hre.ethers.provider);
    }

    const keeperManager = subscriptionManager.connect(keeperWallet);

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
                            gasPrice: parseInt(gasPrice)
                        });
                    if (performEstimatedGas.gt(taskArguments.gasLimit)) {
                        console.log(`Warning: estimatedGas for performUpkeep on queue ${queue} is above gasLimit ${taskArguments.gasLimit}`);
                    }
                    const tx = await keeperManager
                        .performUpkeep(checkResult.performData, {
                            gasLimit: parseInt(taskArguments.gasLimit),
                            gasPrice: parseInt(gasPrice)
                        });
                    const events = (await tx.wait()).events || [];
                    const report = events.find((e) => e.event === "SubscriptionManagerReport");
                    if (report) {
                        console.log(`Report: performed ${report.args.renewals} renewals`);
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
