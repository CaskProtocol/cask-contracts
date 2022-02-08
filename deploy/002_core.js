const {
    isDaoChain,
} = require("../test/_networks");

const {
    deployWithConfirmation,
} = require("../utils/deploy");


const deployCore = async ({ethers}) => {

    await deployWithConfirmation('CaskToken');
}


const main = async (hre) => {
    console.log("Running 002_core deployment...");
    await deployCore(hre);
    console.log("002_core deploy done.");
    return true;
};

main.id = "002_core";
main.skip = () => !isDaoChain;
main.tags = ["core"];

module.exports = main;