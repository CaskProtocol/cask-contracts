const { expect } = require("chai");
const { CaskSDK } = require('@caskprotocol/sdk');

const {
    usdcUnits,
    day,
    hour,
} = require("../utils/units");

const {
    parseUnits
} = require("ethers").utils;

const {
    advanceTimeRunDCAKeeper,
    DCAStatus,
} = require("./_helpers");

const {
    dcaWithLiquidityFixture,
} = require("./fixtures/dca");


describe("CaskDCA General", function () {

    it("Basic DCA lifecycle", async function () {

        const {
            networkAddresses,
            user,
            vault,
            dca,
            usdc,
            abc,
            assetList,
        } = await dcaWithLiquidityFixture();

        const userVault = vault.connect(user);
        const userDCA = dca.connect(user);


        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('100'));

        const assetInfo =  assetList.find((a) => a.path[a.path.length-1].toLowerCase() === abc.address.toLowerCase());
        const merkleProof = CaskSDK.utils.dcaMerkleProof(assetList, assetInfo);

        const assetSpec = [
            assetInfo.router.toLowerCase(),
            assetInfo.priceFeed.toLowerCase(),
            ...assetInfo.path.map((a) => a.toLowerCase())
        ];

        let result;

        // create DCA
        const tx = await userDCA.createDCA(
            assetSpec, // assetSpec
            merkleProof, // merkleProof
            user.address, // to
            usdcUnits('10'), // amount
            0, // totalAmount
            7 * day, // period
            100, // slippageBps
            0, // minPrice
            0 // maxPrice
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "DCACreated");
        const dcaId = createdEvent.args.dcaId;
        expect(dcaId).to.not.be.undefined;
        expect(createdEvent.args.user).to.equal(user.address);
        expect(createdEvent.args.to).to.equal(user.address);
        expect(createdEvent.args.amount).to.equal(usdcUnits('10'));
        expect(createdEvent.args.period).to.equal(7*day);

        // confirm initial DCA was processed
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('90'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('9.97', 18));

        await advanceTimeRunDCAKeeper(9, day);

        // confirm second DCA was processed
        result = await userDCA.getDCA(dcaId);
        console.dir(result);
        expect(result.status).to.equal(DCAStatus.Active);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('80'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('19.94', 18));

        await advanceTimeRunDCAKeeper(7, day);

        // confirm third DCA was processed
        result = await userDCA.getDCA(dcaId);
        console.dir(result);
        expect(result.status).to.equal(DCAStatus.Active);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('70'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('29.91', 18));

    });

});
