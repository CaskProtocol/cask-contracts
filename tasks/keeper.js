async function keeper(taskArguments, hre) {

   console.log(`Keeper running with limit ${taskArguments.limit} on queue ${taskArguments.queue}`)

    while(true) {

        console.log(`Checking for upkeep...`);
        const subscriptionManager = await ethers.getContract("CaskSubscriptionManager");
        const checkData = ethers.utils.defaultAbiCoder.encode(
            ['uint256','uint256','uint8'],
            [
                parseInt(taskArguments.limit),
                parseInt(taskArguments.minDepth),
                parseInt(taskArguments.queue)
            ]);
        const checkResult = await subscriptionManager.checkUpkeep(checkData);
        if (checkResult.upkeepNeeded) {
            console.log(`Upkeep needed. Performing upkeep...`);
            const txn = await subscriptionManager.performUpkeep(checkResult.performData, {gasLimit: 2600000});
            console.log(`Upkeep complete: txn ${txn.hash}`);
        } else {
            console.log(`No upkeep needed.`);
        }

        await new Promise(r => setTimeout(() => r(), parseInt(taskArguments.interval)));
    }
}


module.exports = {
    keeper,
};
