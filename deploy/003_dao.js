const {
    caskUnits,
    caskUnitsFormat,
} = require("../utils/units");

const {
    isDaoChain,
} = require("../test/_networks");

const {
    log,
    deployWithConfirmation,
    withConfirmation,
} = require("../utils/deploy");


const deployDao = async ({ethers, getNamedAccounts}) => {

    const {deployerAddr, governorAddr} = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const caskToken = await ethers.getContract("CaskToken");

    let result;


    /************  INITIAL TOKEN SUPPLY AND VESTING DEFINITIONS **************/

    const tokenSupply = '1000000000';

    const investorVestStart = Math.floor(Date.now() / 1000)+3600;
    const investorVestDuration = (3 * 365 * 86400); // 3 years
    const investorVestCliffDuration = (365 * 86400); // 1 year

    const teamVestStart = Math.floor(Date.now() / 1000)+3600;
    const teamVestDuration = (4 * 365 * 86400); // 4 years
    const teamVestCliffDuration = (365 * 86400); // 1 year

    const treasuryVestStart = Math.floor(Date.now() / 1000)+3600;
    const treasuryVestDuration = (5 * 365 * 86400);



    await deployWithConfirmation('InvestorVestedEscrow',
        [caskToken.address, investorVestStart, investorVestDuration, false, deployerAddr],
        "CaskVestedEscrow");

    await deployWithConfirmation('TeamVestedEscrow',
        [caskToken.address, teamVestStart, teamVestDuration, true, deployerAddr],
        "CaskVestedEscrow");

    await deployWithConfirmation('TreasuryVestedEscrow',
        [caskToken.address, treasuryVestStart, treasuryVestDuration, false, deployerAddr],
        "CaskVestedEscrow");

    const investorVestedEscrow = await ethers.getContract("InvestorVestedEscrow");
    const teamVestedEscrow = await ethers.getContract("TeamVestedEscrow");
    const treasuryVestedEscrow = await ethers.getContract("TreasuryVestedEscrow");


    /******* mint and distribute CASK tokens *********/


    /** mint tokens and send to deployer **/

    result = await withConfirmation(
        caskToken.connect(sDeployer).mint(deployerAddr, caskUnits(tokenSupply))
    );
    log(`Minted initial CASK token supply of ${tokenSupply} tokens to ${deployerAddr}`, result);


    /** deploy treasury  **/

    result = await deployWithConfirmation('CaskTreasury');

    const caskTreasury = await ethers.getContract("CaskTreasury");

    result = await withConfirmation(
        caskTreasury.connect(sDeployer).transferOwnership(governorAddr)
    );
    log(`Transferred CaskTreasury ownership to ${governorAddr}`, result);


    /** fund treasury - 380M (100M community funds + 30M LBP + 250M for protocol chain staking rewards) **/

    result = await withConfirmation(
        caskToken.connect(sDeployer).transfer(caskTreasury.address, caskUnits('380000000'))
    );
    log(`Sent 380M CASK to treasury at ${caskTreasury.address}`, result);


    /** treasury vesting - 250M community funds **/

    result = await withConfirmation(
        caskToken.connect(sDeployer).approve(treasuryVestedEscrow.address, caskUnits('250000000'))
    );
    log(`Approved TreasuryVestedEscrow to spend deployer CASK`, result);
    result = await withConfirmation(
        treasuryVestedEscrow.connect(sDeployer).addTokens(caskUnits('250000000'))
    );
    log(`Added 250M CASK to TreasuryVestedEscrow at ${treasuryVestedEscrow.address}`, result);

    result = await withConfirmation(
        treasuryVestedEscrow.connect(sDeployer)['fund(uint256,address[],uint256[])'](
            treasuryVestStart, [caskTreasury.address],[caskUnits('250000000')]
        )
    );
    log(`Funded 250M CASK in TreasuryVestedEscrow for treasury at ${caskTreasury.address}`, result);


    /** team vesting - 200M **/

    result = await withConfirmation(
        caskToken.connect(sDeployer).approve(teamVestedEscrow.address, caskUnits('200000000'))
    );
    log(`Approved TeamVestedEscrow to spend deployer CASK`, result);
    result = await withConfirmation(
        teamVestedEscrow.connect(sDeployer).addTokens(caskUnits('200000000'))
    );
    log(`Added 200M CASK to TeamVestedEscrow at ${teamVestedEscrow.address}`, result);


    /** investor vesting - 170M **/

    // to be done manually from the multisig at a later date
    // result = await withConfirmation(
    //     caskToken.connect(sDeployer).approve(investorVestedEscrow.address, caskUnits('170000000'))
    // );
    // log(`Approved InvestorVestedEscrow to spend deployer CASK`, result);
    // result = await withConfirmation(
    //     investorVestedEscrow.connect(sDeployer).addTokens(caskUnits('170000000'))
    // );
    // log(`Added 150M CASK to InvestorVestedEscrow at ${investorVestedEscrow.address}`, result);


    /** change vesting contract owners to governor */

    result = await withConfirmation(
        investorVestedEscrow.connect(sDeployer).setAdmin(governorAddr)
    );
    log(`Set admin on InvestorVestedEscrow to ${governorAddr}`, result);

    result = await withConfirmation(
        teamVestedEscrow.connect(sDeployer).setAdmin(governorAddr)
    );
    log(`Set admin on TeamVestedEscrow to ${governorAddr}`, result);

    result = await withConfirmation(
        treasuryVestedEscrow.connect(sDeployer).setAdmin(governorAddr)
    );
    log(`Set admin on TreasuryVestedEscrow to ${governorAddr}`, result);


    const deployerBalance = await caskToken.connect(sDeployer).balanceOf(deployerAddr);
    log(`deployer balance after DAO deploy: ${caskUnitsFormat(deployerBalance)}`);
}

const main = async (hre) => {
    console.log("Running 003_dao deployment...");
    await deployDao(hre);
    console.log("003_dao deploy done.");
    return true;
};

main.id = "003_dao";
main.tags = ["dao"];
main.skip = () => !isDaoChain;
main.dependencies = ["core"];


module.exports = main