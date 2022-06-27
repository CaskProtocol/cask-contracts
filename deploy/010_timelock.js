const {
    hour,
} = require("../utils/units");

const {
    isProtocolChain,
    isMainnet,
    isFork,
} = require("../test/_networks");

const {
    log,
    deployWithConfirmation,
} = require("../utils/deploy");


/**
 * Deploy a timelock to be used as part of cask governance
 */
const deployTimelock = async ({getNamedAccounts}) => {

    const {governorAddr} = await getNamedAccounts();

    let delay = 48 * hour;
    if (!isMainnet && !isFork) {
        delay = 5;
    }
    await deployWithConfirmation('CaskTimelockController',
        [delay, [governorAddr], [governorAddr]],
        "TimelockController");

}

const main = async (hre) => {
    console.log("Running 010_timelock deployment...");
    await deployTimelock(hre);
    console.log("010_timelock deploy done.");
    return true;
};

main.id = "010_timelock";
main.tags = ["timelock"];
main.dependencies = [""];
main.skip = () => !isProtocolChain;

module.exports = main;