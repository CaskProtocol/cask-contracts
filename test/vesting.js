const { expect } = require("chai");

const {
    caskUnits,
    now,
    hour,
    month,
} = require("../utils/units");

const {
    advanceTime,
} = require("./_helpers");

const {
    vestingFixture,
    teamVestingFixture,
    investorVestingFixture,
    teamMultiStartVestingFixture,
} = require("./fixtures/vesting");


describe("VestedEscrow", function () {

    it("Token supply is 1B", async function () {
        const {caskToken} = await vestingFixture();
        expect(await caskToken.totalSupply()).to.equal(caskUnits('1000000000'));
    });

    it("Newly added funds are not vested yet", async function () {
        const {
            governor,
            alice,
            teamVestedEscrow
        } = await vestingFixture();

        const vestingStart = now;

        expect(await teamVestedEscrow.unallocatedSupply()).to.equal(caskUnits('200000000'));

        let tx = await teamVestedEscrow.connect(governor)['fund(uint256,address[],uint256[])'](
            vestingStart, [alice.address],[caskUnits('10000000')]
        );

        let events = (await tx.wait()).events || [];
        let event = events.find((e) => e.event === "Fund");
        let args = event.args;
        expect(args.recipient.toLowerCase()).to.equal(alice.address.toLowerCase());
        expect(args.reward).to.equal(caskUnits('10000000'));

        expect(await teamVestedEscrow.vestedOf(alice.address)).to.equal('0');
        expect(await teamVestedEscrow.lockedOf(alice.address)).to.equal(caskUnits('10000000'));

    });


    it("Team vesting works properly", async function () {
        const {
            alice,
            bob,
            caskToken,
            teamVestedEscrow
        } = await teamVestingFixture();

        await advanceTime(hour); // timing adjustment

        // test start at 0 claimable/vested and full locked balance
        expect(await teamVestedEscrow.balanceOf(alice.address)).to.equal('0');
        expect(await teamVestedEscrow.vestedOf(alice.address)).to.equal('0');
        expect(await teamVestedEscrow.lockedOf(alice.address)).to.equal(caskUnits('48000000'));
        expect(await teamVestedEscrow.balanceOf(bob.address)).to.equal('0');
        expect(await teamVestedEscrow.vestedOf(bob.address)).to.equal('0');
        expect(await teamVestedEscrow.lockedOf(bob.address)).to.equal(caskUnits('96000000'));

        await advanceTime(2 * month);

        // test no vested amounts before cliff
        expect(await teamVestedEscrow.balanceOf(alice.address)).to.equal('0');
        expect(await teamVestedEscrow.vestedOf(alice.address)).to.equal('0');
        expect(await teamVestedEscrow.balanceOf(bob.address)).to.equal('0');
        expect(await teamVestedEscrow.vestedOf(bob.address)).to.equal('0');

        // test alice claiming before cliff
        expect(await teamVestedEscrow.connect(alice)['claim()']()).to.emit(teamVestedEscrow, 'Claim');

        // test token balance did not increase
        expect(await caskToken.connect(alice).balanceOf(alice.address)).to.equal('0'); // claim did nothing

        await advanceTime(12 * month); // 14 months total

        // after 14 months: 14M claimable/total vested and 34M remain locked
        expect(await teamVestedEscrow.balanceOf(alice.address))
            .to.be.closeTo(caskUnits('14000000'), caskUnits('200'));
        expect(await teamVestedEscrow.vestedOf(alice.address))
            .to.be.closeTo(caskUnits('14000000'), caskUnits('200'));
        expect(await teamVestedEscrow.lockedOf(alice.address))
            .to.be.closeTo(caskUnits('34000000'), caskUnits('200'));

        // test alice claiming 2 months after cliff
        await expect(teamVestedEscrow.connect(alice)['claim()']()).to.emit(teamVestedEscrow, 'Claim');

        // check token balance is now 14M
        expect(await caskToken.connect(alice).balanceOf(alice.address))
            .to.be.closeTo(caskUnits('14000000'), caskUnits('200'));

        // after claim, balance should be 0, vested/locked unchanged
        expect(await teamVestedEscrow.balanceOf(alice.address)).to.equal('0');
        expect(await teamVestedEscrow.vestedOf(alice.address))
            .to.be.closeTo(caskUnits('14000000'), caskUnits('200'));
        expect(await teamVestedEscrow.lockedOf(alice.address))
            .to.be.closeTo(caskUnits('34000000'), caskUnits('200'));

        await advanceTime(2 * month); // 16 months total

        // 2M more vested/unlocked
        expect(await teamVestedEscrow.balanceOf(alice.address))
            .to.be.closeTo(caskUnits('2000000'), caskUnits('200'));
        expect(await teamVestedEscrow.vestedOf(alice.address))
            .to.be.closeTo(caskUnits('16000000'), caskUnits('200'));
        expect(await teamVestedEscrow.lockedOf(alice.address))
            .to.be.closeTo(caskUnits('32000000'), caskUnits('200'));

        // bob hasnt claimed - 32M balance/vested, 64M locked
        expect(await teamVestedEscrow.balanceOf(bob.address))
            .to.be.closeTo(caskUnits('32000000'), caskUnits('200'));
        expect(await teamVestedEscrow.vestedOf(bob.address))
            .to.be.closeTo(caskUnits('32000000'), caskUnits('200'));
        expect(await teamVestedEscrow.lockedOf(bob.address))
            .to.be.closeTo(caskUnits('64000000'), caskUnits('200'));

    });

    it("Disable vesting works properly", async function () {
        const {
            governor,
            alice,
            bob,
            teamVestedEscrow
        } = await teamVestingFixture();

        await advanceTime(hour); // timing adjustment

        await advanceTime(2 * month);

        // disable bob before cliff
        await teamVestedEscrow.connect(governor).toggle_disable(bob.address);

        await advanceTime(12 * month); // 14 months total

        expect(await teamVestedEscrow.vestedOf(alice.address))
            .to.be.closeTo(caskUnits('14000000'), caskUnits('200'));
        expect(await teamVestedEscrow.balanceOf(alice.address))
            .to.be.closeTo(caskUnits('14000000'), caskUnits('200'));

        // test bob has 0 since was disabled before cliff
        expect(await teamVestedEscrow.balanceOf(bob.address)).to.equal('0');

        await teamVestedEscrow.connect(governor).toggle_disable(alice.address);

        await advanceTime(2 * month); // 16 months total

        // confirm no vesting increase after disable
        expect(await teamVestedEscrow.vestedOf(alice.address))
            .to.be.closeTo(caskUnits('14000000'), caskUnits('200'));
        expect(await teamVestedEscrow.balanceOf(alice.address))
            .to.be.closeTo(caskUnits('14000000'), caskUnits('200'));
    });

    it("Cannot disable investor vesting", async function () {
        const {
            governor,
            alice,
            investorVestedEscrow
        } = await investorVestingFixture();

        await advanceTime(hour); // timing adjustment

        await advanceTime(2 * month);

        await expect(investorVestedEscrow.connect(governor).toggle_disable(alice.address))
            .to.be.revertedWith("!canDisable");

    });

    it("Cannot over fund vesting contract", async function () {
        const {
            governor,
            alice,
            bob,
            investorVestedEscrow
        } = await vestingFixture();

        // attempt over fund - InvestorVestedEscrow only has 150M in it
        await expect(investorVestedEscrow.connect(governor)['fund(address[],uint256[])'](
            [
                alice.address,
                bob.address
            ],
            [
                caskUnits('150000000'),
                caskUnits('150000000')
            ]
        )).to.be.revertedWith("!balance");

    });

    it("Multiple vesting starts works properly", async function () {
        const {
            alice,
            charlie,
            teamVestedEscrow,
        } = await teamMultiStartVestingFixture();

        await advanceTime(hour); // timing adjustment

        await advanceTime(4 * month);

        // neither cliff ended yet
        expect(await teamVestedEscrow.vestedOf(alice.address)).to.be.equal('0')
        expect(await teamVestedEscrow.balanceOf(alice.address)).to.be.equal('0');
        expect(await teamVestedEscrow.vestedOf(charlie.address)).to.be.equal('0');
        expect(await teamVestedEscrow.balanceOf(charlie.address)).to.be.equal('0')


        await advanceTime(10 * month); // at month 14


        // alice cliff ended at month 12
        expect(await teamVestedEscrow.vestedOf(alice.address))
            .to.be.closeTo(caskUnits('14000000'), caskUnits('200'));
        expect(await teamVestedEscrow.balanceOf(alice.address))
            .to.be.closeTo(caskUnits('14000000'), caskUnits('200'));

        // charlie cliff not ended yet
        expect(await teamVestedEscrow.vestedOf(charlie.address)).to.be.equal('0');
        expect(await teamVestedEscrow.balanceOf(charlie.address)).to.be.equal('0')


        await advanceTime(10 * month); // at month 24


        // both cliffs ended, charlie vesting is 3 months behind alice

        expect(await teamVestedEscrow.vestedOf(alice.address))
            .to.be.closeTo(caskUnits('24000000'), caskUnits('200'));
        expect(await teamVestedEscrow.balanceOf(alice.address))
            .to.be.closeTo(caskUnits('24000000'), caskUnits('200'));

        expect(await teamVestedEscrow.vestedOf(charlie.address))
            .to.be.closeTo(caskUnits('21000000'), caskUnits('200'));
        expect(await teamVestedEscrow.balanceOf(charlie.address))
            .to.be.closeTo(caskUnits('21000000'), caskUnits('200'));

    });

});
