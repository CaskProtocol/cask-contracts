async function keeper(taskArguments, hre) {

    const queues = taskArguments.queue.split(/\s*,\s*/);

    console.log(`Keeper running with limit ${taskArguments.limit} on queue(s) ${queues}`)

    while(true) {

        for (let i = 0; i < queues.length; i++) {
            const queue = queues[i];
            console.log(`Checking for upkeep on queue ${queue}...`);
            const subscriptionManager = await ethers.getContract("CaskSubscriptionManager");
            const checkData = ethers.utils.defaultAbiCoder.encode(
                ['uint256','uint256','uint8'],
                [
                    parseInt(taskArguments.limit),
                    parseInt(taskArguments.minDepth),
                    parseInt(queue)
                ]);
            const checkEstimatedGas = await subscriptionManager.estimateGas.checkUpkeep(checkData);
            if (checkEstimatedGas.gt(taskArguments.gasLimit)){
                console.log(`Warning: estimatedGas for checkUpkeep on queue ${queue} is above gasLimit ${taskArguments.gasLimit}`);
            }
            const checkResult = await subscriptionManager.checkUpkeep(checkData);
            if (checkResult.upkeepNeeded) {
                console.log(`Upkeep needed on queue ${queue}. Performing upkeep...`);
                const performEstimatedGas = await subscriptionManager.estimateGas
                    .performUpkeep(checkResult.performData, {gasLimit: parseInt(taskArguments.gasLimit)});
                if (performEstimatedGas.gt(taskArguments.gasLimit)){
                    console.log(`Warning: estimatedGas for performUpkeep on queue ${queue} is above gasLimit ${taskArguments.gasLimit}`);
                }
                const txn = await subscriptionManager
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
