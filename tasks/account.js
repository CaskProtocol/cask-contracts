async function accounts(taskArguments, hre, privateKeys) {
    const accounts = await hre.ethers.getSigners();
    const roles = ["Deployer", "Governor","Strategist","-",
        "consumerA","consumerB","consumerC","providerA","providerB","providerC"];

    const isMainnetOrRinkeby = ["mainnet", "rinkeby"].includes(hre.network.name);
    if (isMainnetOrRinkeby) {
        privateKeys = [process.env.DEPLOYER_PK, process.env.STRATEGIST_PK];
    }

    let i = 0;
    for (const account of accounts) {
        const role = roles.length > i ? `[${roles[i]}]` : "";
        const address = await account.getAddress();
        console.log(address, privateKeys[i], role);
        if (!address) {
            throw new Error(`No address defined for role ${role}`);
        }
        i++;
    }
}


module.exports = {
    accounts,
};
