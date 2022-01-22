const addresses = require("../utils/addresses");

const getNetworkAddresses = async (hre) => {
    const deployments = hre.deployments;

    if (hre.network.name === 'polygon') {
        return addresses.polygon;
    } else if (hre.network.name === 'mumbai') {
        return {
            DAI_USD: addresses.mumbai.DAI_USD,
            USDC_USD: addresses.mumbai.USDC_USD,
            USDT_USD: addresses.mumbai.USDT_USD,
            WETH_USD: addresses.mumbai.WETH_USD,
            USDT: (await deployments.get("FakeUSDT")).address,
            USDC: (await deployments.get("FakeUSDC")).address,
            DAI: (await deployments.get("FakeDAI")).address,
            WETH: (await deployments.get("FakeWETH")).address,
        }
    } else {
        // On other environments, return mock feeds.
        return {
            DAI_USD: (await deployments.get("MockChainlinkOracleFeedDAI")).address,
            USDC_USD: (await deployments.get("MockChainlinkOracleFeedUSDC")).address,
            USDT_USD: (await deployments.get("MockChainlinkOracleFeedUSDT")).address,
            WETH_USD: (await deployments.get("MockChainlinkOracleFeedWETH")).address,
            USDT: (await deployments.get("MockUSDT")).address,
            USDC: (await deployments.get("MockUSDC")).address,
            DAI: (await deployments.get("MockDAI")).address,
            WETH: (await deployments.get("MockWETH")).address,
        };
    }
};


async function fund(taskArguments, hre, privateKeys) {
    const accounts = await hre.ethers.getSigners();

    const addrs = await getNetworkAddresses(hre);



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
    fund,
};
