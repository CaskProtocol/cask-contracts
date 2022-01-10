const {
    isMumbai
} = require("../test/_helpers");

const {
    log,
    deployWithConfirmation,
    withConfirmation,
} = require("../utils/deploy");

const deployFakes = async ({getNamedAccounts}) => {
    const {faucetAdmin} = await getNamedAccounts();

    // Deploy mock coins (assets)
    const assetContracts = [
        "FakeDAI",
        "FakeUSDC",
        "FakeUSDT",
        "FakeWETH",
    ];
    for (const contract of assetContracts) {
        await deployWithConfirmation(contract);

        const deployedContract = await ethers.getContract(contract);

        await withConfirmation(
            deployedContract.grantRole(await deployedContract.MINTER_ROLE(), faucetAdmin)
        );
        log(`Granted MINTER_ROLE on ${contract} at ${deployedContract.address} to faucetAdmin ${faucetAdmin}`);
    }

};

const main = async (hre) => {
    console.log("Running 000_fakes deployment...");
    await deployFakes(hre);
    console.log("000_fakes deploy done.");
    return true;
};

main.id = "000_fakes";
main.tags = ["fakes"];
main.skip = () => !isMumbai;

module.exports = main