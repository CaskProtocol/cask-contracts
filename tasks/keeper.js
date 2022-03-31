async function keeper(taskArguments, hre) {

    const subscriptionManager = await ethers.getContract("CaskSubscriptionManager");
    const queues = taskArguments.queue.split(/\s*,\s*/);

    const keeperWallet = new ethers.Wallet(process.env.TESTNET_KEEPER_PK, hre.ethers.provider);
    const keeperManager = subscriptionManager.connect(keeperWallet);

    console.log(`Keeper ${keeper.address} running with limit ${taskArguments.limit} on queue(s) ${queues}`)

    while(true) {

        for (let i = 0; i < queues.length; i++) {
            const queue = queues[i];
            console.log(`Checking for upkeep on queue ${queue}...`);

            const checkData = ethers.utils.defaultAbiCoder.encode(
                ['uint256','uint256','uint8'],
                [
                    parseInt(taskArguments.limit),
                    parseInt(taskArguments.minDepth),
                    parseInt(queue)
                ]);
            const checkEstimatedGas = await keeperManager.estimateGas.checkUpkeep(checkData);
            if (checkEstimatedGas.gt(taskArguments.gasLimit)){
                console.log(`Warning: estimatedGas for checkUpkeep on queue ${queue} is above gasLimit ${taskArguments.gasLimit}`);
            }
            const checkResult = await keeperManager.checkUpkeep(checkData);
            if (checkResult.upkeepNeeded) {
                console.log(`Upkeep needed on queue ${queue}. Performing upkeep...`);
                const performEstimatedGas = await keeperManager.estimateGas
                    .performUpkeep(checkResult.performData, {gasLimit: parseInt(taskArguments.gasLimit)});
                if (performEstimatedGas.gt(taskArguments.gasLimit)){
                    console.log(`Warning: estimatedGas for performUpkeep on queue ${queue} is above gasLimit ${taskArguments.gasLimit}`);
                }
                const txn = await keeperManager
                    .performUpkeep(checkResult.performData, {gasLimit: parseInt(taskArguments.gasLimit)});
                console.log(`Upkeep complete for queue ${queue}: txn ${txn.hash}`);
            } else {
                console.log(`No upkeep needed on queue ${queue}.`);
            }
        }

        await new Promise(r => setTimeout(() => r(), parseInt(taskArguments.interval)));
    }
}


module.exports = {
    keeper,
};
