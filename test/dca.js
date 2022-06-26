const { expect } = require("chai");
const { CaskSDK } = require('@caskprotocol/sdk');

const {
    usdcUnits,
    day,
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
    dcaWithLiquidityFixtureNoPricefeed,
} = require("./fixtures/dca");


describe("CaskDCA General", function () {

    it("Basic DCA lifecycle", async function () {

        const {
            networkAddresses,
            user,
            vault,
            dca,
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

        const assetInfo =  CaskSDK.utils.getDCAAsset(assetList, abc.address);
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
            parseUnits('0.99', 18), // minPrice
            parseUnits('1.01', 18) // maxPrice
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
        expect(result.status).to.equal(DCAStatus.Active);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('80'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('19.94', 18));

        await advanceTimeRunDCAKeeper(7, day);

        // confirm third DCA was processed
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(DCAStatus.Active);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('70'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('29.91', 18));

    });

    it("Basic DCA lifecycle using router prices", async function () {

        const {
            networkAddresses,
            user,
            vault,
            dca,
            abc,
            assetList,
        } = await dcaWithLiquidityFixtureNoPricefeed();

        const userVault = vault.connect(user);
        const userDCA = dca.connect(user);


        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('100'));

        const assetInfo =  CaskSDK.utils.getDCAAsset(assetList, abc.address);
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
        expect(result.status).to.equal(DCAStatus.Active);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('80'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('19.94', 18));

        await advanceTimeRunDCAKeeper(7, day);

        // confirm third DCA was processed
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(DCAStatus.Active);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('70'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('29.91', 18));

    });

    it("DCA with totalAmount", async function () {

        const {
            networkAddresses,
            user,
            vault,
            dca,
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

        const assetInfo =  CaskSDK.utils.getDCAAsset(assetList, abc.address);
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
            usdcUnits('25'), // totalAmount
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

        await advanceTimeRunDCAKeeper(9, day);

        // confirm second DCA was processed
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(DCAStatus.Active);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('80'));

        await advanceTimeRunDCAKeeper(7, day);

        // confirm third DCA was processed for only 5 USDC which totals the 25 USDC limit
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(DCAStatus.Complete);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('75'));
    });

    it("DCA fails with bad proof", async function () {

        const {
            networkAddresses,
            user,
            vault,
            dca,
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

        const assetInfo =  CaskSDK.utils.getDCAAsset(assetList, abc.address);

        const assetSpec = [
            assetInfo.router.toLowerCase(),
            assetInfo.priceFeed.toLowerCase(),
            ...assetInfo.path.map((a) => a.toLowerCase())
        ];

        // create DCA
        await expect(userDCA.createDCA(
            assetSpec, // assetSpec
            ['0x56a9e930d5992a8446ba6814144d4ae98194eaf9d8210be85ed01614b45effff'], // bad merkleProof
            user.address, // to
            usdcUnits('10'), // amount
            0, // totalAmount
            7 * day, // period
            100, // slippageBps
            0, // minPrice
            0 // maxPrice
        )).to.be.revertedWith("!INVALID(assetSpec)");

    });

    it("DCA with minPrice not met", async function () {

        const {
            networkAddresses,
            user,
            vault,
            dca,
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

        const assetInfo =  CaskSDK.utils.getDCAAsset(assetList, abc.address);
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
            parseUnits('1.1', 18), // minPrice
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

        // confirm initial DCA was skipped due to minPrice
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('100'));

        await advanceTimeRunDCAKeeper(9, day);

        // confirm second DCA was processed
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(DCAStatus.Active);
        expect(result.numSkips).to.equal(2);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('100'));
    });

    it("DCA with maxPrice not met", async function () {

        const {
            networkAddresses,
            user,
            vault,
            dca,
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

        const assetInfo =  CaskSDK.utils.getDCAAsset(assetList, abc.address);
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
            parseUnits('0.9', 18), // maxPrice
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "DCACreated");
        const dcaId = createdEvent.args.dcaId;
        expect(dcaId).to.not.be.undefined;
        expect(createdEvent.args.user).to.equal(user.address);
        expect(createdEvent.args.to).to.equal(user.address);
        expect(createdEvent.args.amount).to.equal(usdcUnits('10'));
        expect(createdEvent.args.period).to.equal(7*day);

        // confirm initial DCA was skipped due to minPrice
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('100'));

        await advanceTimeRunDCAKeeper(9, day);

        // confirm second DCA was processed
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(DCAStatus.Active);
        expect(result.numSkips).to.equal(2);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('100'));
    });

});
