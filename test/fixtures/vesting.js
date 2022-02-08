const {
    caskUnits,
    now,
    hour,
    month,
    year,
} = require("../../utils/units");


async function vestingFixture() {
    await deployments.fixture(); // ensure you start from a fresh deployments

    // accounts
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const governor = signers[1];
    const alice = signers[11];
    const bob = signers[12];
    const charlie = signers[13];

    // contracts
    const caskToken = await ethers.getContract("CaskToken");
    const teamVestedEscrow = await ethers.getContract("TeamVestedEscrow");
    const investorVestedEscrow = await ethers.getContract("InvestorVestedEscrow");

    // send remaining CASK tokens to governor
    await caskToken.connect(deployer).transfer(governor.address, caskUnits('170000000'));

    // example funding of investorVestedEscrow for testing
    await caskToken.connect(governor).approve(investorVestedEscrow.address, caskUnits('170000000'));
    await investorVestedEscrow.connect(governor).addTokens(caskUnits('170000000'));


    return {
        //accounts
        deployer,
        governor,
        alice,
        bob,
        charlie,
        caskToken,
        teamVestedEscrow,
        investorVestedEscrow,
    };
}

async function investorVestingFixture() {
    const fixture = await vestingFixture();

    fixture.vestingStart = now + hour;

    await fixture.investorVestedEscrow.connect(fixture.governor)['fund(uint256,address[],uint256[])'](
        fixture.vestingStart,
        [
            fixture.alice.address,
            fixture.bob.address
        ],
        [
            caskUnits('48000000'), // 1M per month over 3 years
            caskUnits('96000000') // 2M per month over 3 years
        ]
    );

    return fixture;
}

async function teamVestingFixture() {
    const fixture = await vestingFixture();

    fixture.vestingStart = now + hour;
    fixture.cliffDuration = year;

    await fixture.teamVestedEscrow.connect(fixture.governor)['fund(uint256,uint256,address[],uint256[])'](
        fixture.vestingStart,
        fixture.cliffDuration,
        [
            fixture.alice.address,
            fixture.bob.address,
            fixture.charlie.address
        ],
        [
            caskUnits('48000000'), // 1M per month over 4 years
            caskUnits('96000000'), // 2M per month over 4 years
            caskUnits('48000000') // 1M per month over 4 years
        ]
    );

    return fixture;
}

async function teamMultiStartVestingFixture() {
    const fixture = await vestingFixture();

    fixture.vestingStart = now + hour;
    fixture.cliffDuration = year;

    await fixture.teamVestedEscrow.connect(fixture.governor)['fund(uint256,uint256,address[],uint256[])'](
        fixture.vestingStart,
        fixture.cliffDuration,
        [
            fixture.alice.address,
            fixture.bob.address,
        ],
        [
            caskUnits('48000000'), // 1M per month over 4 years
            caskUnits('96000000'), // 2M per month over 4 years
        ]
    );

    await fixture.teamVestedEscrow.connect(fixture.governor)['fund(uint256,uint256,address[],uint256[])'](
        fixture.vestingStart + (3 * month),
        fixture.cliffDuration,
        [
            fixture.charlie.address
        ],
        [
            caskUnits('48000000') // 1M per month over 4 years
        ]
    );

    return fixture;
}


module.exports = {
    vestingFixture,
    teamVestingFixture,
    investorVestingFixture,
    teamMultiStartVestingFixture,
}