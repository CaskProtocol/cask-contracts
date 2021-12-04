//
// Deployment utilities
//

const hre = require("hardhat");

const {
    isMainnet,
    isTestnet,
    isRealChain,
} = require("../test/_helpers.js");

const { getTxOpts } = require("../utils/tx.js");

// Wait for 3 blocks confirmation on Mainnet/Testnets.
const NUM_CONFIRMATIONS = isMainnet || isTestnet ? 3 : 0;

function log(msg, deployResult = null) {
    if (isRealChain || process.env.VERBOSE) {
        if (deployResult && deployResult.receipt) {
            const gasUsed = Number(deployResult.receipt.gasUsed.toString());
            msg += ` Address: ${deployResult.address} Gas Used: ${gasUsed}`;
        }
        console.log("INFO:", msg);
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const deployWithConfirmation = async (
    contractName,
    args,
    contract
) => {

    const { deploy } = deployments;
    const { deployerAddr } = await getNamedAccounts();
    if (!args) args = null;
    if (!contract) contract = contractName;
    const result = await withConfirmation(
        deploy(contractName, {
            from: deployerAddr,
            args,
            contract,
            fieldsToCompare: null,
            ...(await getTxOpts()),
        })
    );


    log(`Deployed ${contractName}`, result);
    return result;
};

const deployProxyWithConfirmation = async (
    contractName,
    args,
    contract
) => {

    const { deploy } = deployments;
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    if (!args) args = null;
    if (!contract) contract = contractName;
    const result = await withConfirmation(
        deploy(contractName, {
            from: deployerAddr,
            proxy: { owner: governorAddr, proxyContract: "OpenZeppelinTransparentProxy" },
            args,
            contract,
            fieldsToCompare: null,
            ...(await getTxOpts()),
        })
    );


    log(`Deployed proxy enabled ${contractName}`, result);
    return result;
};

const withConfirmation = async (deployOrTransactionPromise) => {
    const result = await deployOrTransactionPromise;
    await hre.ethers.provider.waitForTransaction(
        result.receipt ? result.receipt.transactionHash : result.hash,
        NUM_CONFIRMATIONS
    );
    return result;
};


module.exports = {
    log,
    sleep,
    deployWithConfirmation,
    deployProxyWithConfirmation,
    withConfirmation,
};
