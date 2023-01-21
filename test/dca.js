const { expect } = require("chai");
const { CaskSDK } = require('@caskprotocol/sdk');

const {
    usdcUnits,
    daiUnits,
    day,
} = require("../utils/units");

const {
    parseUnits
} = require("ethers").utils;

const {
    advanceTimeRunDCAKeeper,
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
            dcaManifest,
        } = await dcaWithLiquidityFixture();

        const userVault = vault.connect(user);
        const userDCA = dca.connect(user);


        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('1000'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('1000'));

        const assetInfo =  CaskSDK.utils.getDCAAsset(dcaManifest.assets, abc.address);
        const assetSpec = CaskSDK.utils.dcaAssetspec(assetInfo);
        const merkleProof = CaskSDK.utils.dcaMerkleProof(dcaManifest.assets, assetInfo);
        const priceSpec = CaskSDK.utils.dcaPricespec(
            7 * day, // period
            usdcUnits('100'), // amount
            0, // totalAmount
            100, // maxSlippageBps
            parseUnits('0.99', 18), // minPrice
            parseUnits('1.01', 18) // maxPrice
        );

        let result;

        // create DCA
        const tx = await userDCA.createDCA(
            assetSpec,
            merkleProof,
            assetInfo.swapProtocol,
            assetInfo.swapData,
            user.address, // to
            priceSpec
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "DCACreated");
        const dcaId = createdEvent.args.dcaId;
        expect(dcaId).to.not.be.undefined;
        expect(createdEvent.args.user).to.equal(user.address);
        expect(createdEvent.args.to).to.equal(user.address);
        expect(createdEvent.args.amount).to.equal(usdcUnits('100'));
        expect(createdEvent.args.period).to.equal(7*day);

        // confirm initial DCA was processed
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('900'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('99.70', 18));

        await advanceTimeRunDCAKeeper(9, day);

        // confirm second DCA was processed
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('800'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('199.40', 18));

        await advanceTimeRunDCAKeeper(7, day);

        // confirm third DCA was processed
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('700'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('299.10', 18));

    });

    it("DCA minFee enforced", async function () {

        const {
            networkAddresses,
            user,
            vault,
            dca,
            abc,
            dcaManifest,
        } = await dcaWithLiquidityFixture();

        const userVault = vault.connect(user);
        const userDCA = dca.connect(user);


        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('100'));

        const assetInfo =  CaskSDK.utils.getDCAAsset(dcaManifest.assets, abc.address);
        const assetSpec = CaskSDK.utils.dcaAssetspec(assetInfo);
        const merkleProof = CaskSDK.utils.dcaMerkleProof(dcaManifest.assets, assetInfo);
        const priceSpec = CaskSDK.utils.dcaPricespec(
            7 * day, // period
            usdcUnits('10'), // amount
            0, // totalAmount
            100, // maxSlippageBps
            parseUnits('0.99', 18), // minPrice
            parseUnits('1.01', 18) // maxPrice
        );

        let result;

        // create DCA
        const tx = await userDCA.createDCA(
            assetSpec, // assetSpec
            merkleProof, // merkleProof
            assetInfo.swapProtocol,
            assetInfo.swapData,
            user.address, // to
            priceSpec
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
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('9.90', 18)); // 0.10 min fee

        await advanceTimeRunDCAKeeper(9, day);

        // confirm second DCA was processed
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('80'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('19.80', 18)); // 0.10 min fee

        await advanceTimeRunDCAKeeper(7, day);

        // confirm third DCA was processed
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('70'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('29.70', 18)); // 0.10 min fee
    });

    it("Basic DCA lifecycle using router prices", async function () {

        const {
            networkAddresses,
            user,
            vault,
            dca,
            abc,
            dcaManifest,
        } = await dcaWithLiquidityFixtureNoPricefeed();

        const userVault = vault.connect(user);
        const userDCA = dca.connect(user);


        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('1000'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('1000'));

        const assetInfo =  CaskSDK.utils.getDCAAsset(dcaManifest.assets, abc.address);
        const assetSpec = CaskSDK.utils.dcaAssetspec(assetInfo);
        const merkleProof = CaskSDK.utils.dcaMerkleProof(dcaManifest.assets, assetInfo);
        const priceSpec = CaskSDK.utils.dcaPricespec(
            7 * day, // period
            usdcUnits('100'), // amount
            0, // totalAmount
            100, // maxSlippageBps
            0, // minPrice
            0 // maxPrice
        );

        let result;

        // create DCA
        const tx = await userDCA.createDCA(
            assetSpec, // assetSpec
            merkleProof, // merkleProof
            assetInfo.swapProtocol,
            assetInfo.swapData,
            user.address, // to
            priceSpec
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "DCACreated");
        const dcaId = createdEvent.args.dcaId;
        expect(dcaId).to.not.be.undefined;
        expect(createdEvent.args.user).to.equal(user.address);
        expect(createdEvent.args.to).to.equal(user.address);
        expect(createdEvent.args.amount).to.equal(usdcUnits('100'));
        expect(createdEvent.args.period).to.equal(7*day);

        // confirm initial DCA was processed
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('900'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('99.70', 18));

        await advanceTimeRunDCAKeeper(9, day);

        // confirm second DCA was processed
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('800'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('199.40', 18));

        await advanceTimeRunDCAKeeper(7, day);

        // confirm third DCA was processed
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('700'));
        expect(await abc.balanceOf(user.address)).to.equal(parseUnits('299.10', 18));

    });

    it("DCA with totalAmount", async function () {

        const {
            networkAddresses,
            user,
            vault,
            dca,
            abc,
            dcaManifest,
        } = await dcaWithLiquidityFixture();

        const userVault = vault.connect(user);
        const userDCA = dca.connect(user);


        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('1000'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('1000'));

        const assetInfo =  CaskSDK.utils.getDCAAsset(dcaManifest.assets, abc.address);
        const assetSpec = CaskSDK.utils.dcaAssetspec(assetInfo);
        const merkleProof = CaskSDK.utils.dcaMerkleProof(dcaManifest.assets, assetInfo);
        const priceSpec = CaskSDK.utils.dcaPricespec(
            7 * day, // period
            usdcUnits('100'), // amount
            usdcUnits('250'), // totalAmount
            100, // maxSlippageBps
            0, // minPrice
            0 // maxPrice
        );

        let result;

        // create DCA
        const tx = await userDCA.createDCA(
            assetSpec, // assetSpec
            merkleProof, // merkleProof
            assetInfo.swapProtocol,
            assetInfo.swapData,
            user.address, // to
            priceSpec
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "DCACreated");
        const dcaId = createdEvent.args.dcaId;
        expect(dcaId).to.not.be.undefined;
        expect(createdEvent.args.user).to.equal(user.address);
        expect(createdEvent.args.to).to.equal(user.address);
        expect(createdEvent.args.amount).to.equal(usdcUnits('100'));
        expect(createdEvent.args.period).to.equal(7*day);

        // confirm initial DCA was processed
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('900'));

        await advanceTimeRunDCAKeeper(9, day);

        // confirm second DCA was processed
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('800'));

        await advanceTimeRunDCAKeeper(7, day);

        // confirm third DCA was processed for only 50 USDC which totals the 250 USDC limit
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.COMPLETE);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('750'));
    });

    it("DCA fails with bad proof", async function () {

        const {
            networkAddresses,
            user,
            vault,
            dca,
            abc,
            dcaManifest,
        } = await dcaWithLiquidityFixture();

        const userVault = vault.connect(user);
        const userDCA = dca.connect(user);


        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('100'));

        const assetInfo =  CaskSDK.utils.getDCAAsset(dcaManifest.assets, abc.address);
        const assetSpec = CaskSDK.utils.dcaAssetspec(assetInfo);
        const priceSpec = CaskSDK.utils.dcaPricespec(
            7 * day, // period
            usdcUnits('10'), // amount
            0, // totalAmount
            100, // maxSlippageBps
            0, // minPrice
            0 // maxPrice
        );

        // create DCA
        await expect(userDCA.createDCA(
            assetSpec, // assetSpec
            ['0x56a9e930d5992a8446ba6814144d4ae98194eaf9d8210be85ed01614b45effff'], // bad merkleProof
            assetInfo.swapProtocol,
            assetInfo.swapData,
            user.address, // to
            priceSpec
        )).to.be.revertedWith("!INVALID(assetSpec)");

    });

    it("DCA with minPrice not met", async function () {

        const {
            networkAddresses,
            user,
            vault,
            priceFeed,
            dca,
            abc,
            dcaManifest,
        } = await dcaWithLiquidityFixture();

        const userVault = vault.connect(user);
        const userDCA = dca.connect(user);


        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('100'));

        const assetInfo =  CaskSDK.utils.getDCAAsset(dcaManifest.assets, abc.address);
        const assetSpec = CaskSDK.utils.dcaAssetspec(assetInfo);
        const merkleProof = CaskSDK.utils.dcaMerkleProof(dcaManifest.assets, assetInfo);
        const priceSpec = CaskSDK.utils.dcaPricespec(
            7 * day, // period
            usdcUnits('10'), // amount
            0, // totalAmount
            100, // maxSlippageBps
            parseUnits('0.9', 18), // minPrice
            0 // maxPrice
        );

        let result;

        // create DCA
        const tx = await userDCA.createDCA(
            assetSpec, // assetSpec
            merkleProof, // merkleProof
            assetInfo.swapProtocol,
            assetInfo.swapData,
            user.address, // to
            priceSpec
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
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(result.numSkips).to.equal(0);

        // change price of ABC so its no longer in range
        await priceFeed.setPrice(ethers.utils.parseUnits("0.5", 8)); // set ABC price to 0.5 USDC - below minPrice

        await advanceTimeRunDCAKeeper(9, day);

        // confirm second DCA was skipped
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(result.numSkips).to.equal(1);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('89.9')); // minus minFee
    });

    it("DCA with maxPrice not met", async function () {

        const {
            networkAddresses,
            user,
            vault,
            priceFeed,
            dca,
            abc,
            dcaManifest,
        } = await dcaWithLiquidityFixture();

        const userVault = vault.connect(user);
        const userDCA = dca.connect(user);


        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('100'));

        const assetInfo =  CaskSDK.utils.getDCAAsset(dcaManifest.assets, abc.address);
        const assetSpec = CaskSDK.utils.dcaAssetspec(assetInfo);
        const merkleProof = CaskSDK.utils.dcaMerkleProof(dcaManifest.assets, assetInfo);
        const priceSpec = CaskSDK.utils.dcaPricespec(
            7 * day, // period
            usdcUnits('10'), // amount
            0, // totalAmount
            100, // maxSlippageBps
            0, // minPrice
            parseUnits('1.1', 18) // maxPrice
        );

        let result;

        // create DCA
        const tx = await userDCA.createDCA(
            assetSpec, // assetSpec
            merkleProof, // merkleProof
            assetInfo.swapProtocol,
            assetInfo.swapData,
            user.address, // to
            priceSpec
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
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(result.numSkips).to.equal(0);

        await advanceTimeRunDCAKeeper(7 * 5 + 2, day);

        // change price of ABC so its no longer in range
        await priceFeed.setPrice(ethers.utils.parseUnits("1.5", 8)); // set ABC price to 1.5 USDC - above maxPrice

        await advanceTimeRunDCAKeeper(9, day);

        // confirm second DCA was skipped
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(result.numSkips).to.equal(1);
        expect(result.numBuys).to.equal(6);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('39.9')); // minus minFee
    });

    it("DCA min value enforced", async function () {

        const {
            networkAddresses,
            user,
            vault,
            dca,
            abc,
            dcaManifest,
        } = await dcaWithLiquidityFixture();

        const userVault = vault.connect(user);
        const userDCA = dca.connect(user);


        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('100'));

        const assetInfo =  CaskSDK.utils.getDCAAsset(dcaManifest.assets, abc.address);
        const assetSpec = CaskSDK.utils.dcaAssetspec(assetInfo);
        const merkleProof = CaskSDK.utils.dcaMerkleProof(dcaManifest.assets, assetInfo);
        const priceSpec = CaskSDK.utils.dcaPricespec(
            7 * day, // period
            usdcUnits('0.90'), // amount
            0, // totalAmount
            100, // maxSlippageBps
            0, // minPrice
            0 // maxPrice
        );

        // create DCA
        await expect(userDCA.createDCA(
            assetSpec, // assetSpec
            merkleProof, // merkleProof
            assetInfo.swapProtocol,
            assetInfo.swapData,
            user.address, // to
            priceSpec
        )).to.be.revertedWith("!UNPROCESSABLE");

    });

    it("DCA range at create time value enforced", async function () {

        const {
            networkAddresses,
            user,
            vault,
            dca,
            abc,
            dcaManifest,
        } = await dcaWithLiquidityFixture();

        const userVault = vault.connect(user);
        const userDCA = dca.connect(user);


        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('100'));

        const assetInfo =  CaskSDK.utils.getDCAAsset(dcaManifest.assets, abc.address);
        const assetSpec = CaskSDK.utils.dcaAssetspec(assetInfo);
        const merkleProof = CaskSDK.utils.dcaMerkleProof(dcaManifest.assets, assetInfo);
        const priceSpec = CaskSDK.utils.dcaPricespec(
            7 * day, // period
            usdcUnits('10'), // amount
            0, // totalAmount
            100, // maxSlippageBps
            parseUnits('1.1', 18), // minPrice
            parseUnits('1.5', 18) // maxPrice
        );

        // create DCA
        await expect(userDCA.createDCA(
            assetSpec, // assetSpec
            merkleProof, // merkleProof
            assetInfo.swapProtocol,
            assetInfo.swapData,
            user.address, // to
            priceSpec
        )).to.be.revertedWith("!UNPROCESSABLE"); // current price is 1 USDC per ABC - outside of DCA price range
    });

    it("assetSpec blacklist works", async function () {

        const {
            networkAddresses,
            governor,
            user,
            vault,
            dca,
            abc,
            dcaManifest,
        } = await dcaWithLiquidityFixture();

        const userVault = vault.connect(user);
        const userDCA = dca.connect(user);

        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('100'));

        const assetInfo =  CaskSDK.utils.getDCAAsset(dcaManifest.assets, abc.address);
        const assetSpec = CaskSDK.utils.dcaAssetspec(assetInfo);
        const merkleProof = CaskSDK.utils.dcaMerkleProof(dcaManifest.assets, assetInfo);
        const priceSpec = CaskSDK.utils.dcaPricespec(
            7 * day, // period
            usdcUnits('10'), // amount
            0, // totalAmount
            100, // maxSlippageBps
            0, // minPrice
            0 // maxPrice
        );

        const assetSpecHash = CaskSDK.utils.dcaAssetspecHash(assetInfo);

        const dcaManager = await ethers.getContract("CaskDCAManager");
        await dcaManager.connect(governor).blacklistAssetspec(assetSpecHash);

        // create DCA
        await expect(userDCA.createDCA(
            assetSpec, // assetSpec
            merkleProof, // merkleProof
            assetInfo.swapProtocol,
            assetInfo.swapData,
            user.address, // to
            priceSpec
        )).to.be.revertedWith("!UNPROCESSABLE");

    });

    it("DCA failed swap reverts properly", async function () {

        const {
            networkAddresses,
            governor,
            user,
            vault,
            router,
            dca,
            abc,
            dcaManifest,
        } = await dcaWithLiquidityFixture();

        const userVault = vault.connect(user);
        const userDCA = dca.connect(user);

        // deposit to vault
        await userVault.deposit(networkAddresses.USDC, usdcUnits('100'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('100'));

        const assetInfo =  CaskSDK.utils.getDCAAsset(dcaManifest.assets, abc.address);
        const assetSpec = CaskSDK.utils.dcaAssetspec(assetInfo);
        const merkleProof = CaskSDK.utils.dcaMerkleProof(dcaManifest.assets, assetInfo);
        const priceSpec = CaskSDK.utils.dcaPricespec(
            7 * day, // period
            usdcUnits('10'), // amount
            0, // totalAmount
            100, // maxSlippageBps
            0, // minPrice
            0 // maxPrice
        );

        let result;

        // create DCA
        const tx = await userDCA.createDCA(
            assetSpec, // assetSpec
            merkleProof, // merkleProof
            assetInfo.swapProtocol,
            assetInfo.swapData,
            user.address, // to
            priceSpec
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "DCACreated");
        const dcaId = createdEvent.args.dcaId;
        expect(dcaId).to.not.be.undefined;

        // confirm initial DCA was processed
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('90'));
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(result.numSkips).to.equal(0);

        // set swap router to fail the swap
        await router.setOutputBps(0);

        await advanceTimeRunDCAKeeper(9, day);

        // confirm second DCA was skipped
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(result.numSkips).to.equal(1);
        expect(await userVault.currentValueOf(user.address)).to.equal(usdcUnits('90'));
    });

    it("DCA with DAI input works", async function () {

        const {
            networkAddresses,
            user,
            vault,
            dca,
            abc,
            dcaManifest,
        } = await dcaWithLiquidityFixture();

        const userVault = vault.connect(user);
        const userDCA = dca.connect(user);


        // deposit to vault
        await userVault.deposit(networkAddresses.DAI, daiUnits('1000'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('1000'));

        const assetInfo = dcaManifest.assets.find((a) => a.inputAssetSymbol === 'DAI' && a.outputAssetSymbol === 'ABC');
        const assetSpec = CaskSDK.utils.dcaAssetspec(assetInfo);
        const merkleProof = CaskSDK.utils.dcaMerkleProof(dcaManifest.assets, assetInfo);
        const priceSpec = CaskSDK.utils.dcaPricespec(
            7 * day, // period
            usdcUnits('100'), // amount
            0, // totalAmount
            100, // maxSlippageBps
            0, // minPrice
            0 // maxPrice
        );

        let result;

        // create DCA
        const tx = await userDCA.createDCA(
            assetSpec, // assetSpec
            merkleProof, // merkleProof
            assetInfo.swapProtocol,
            assetInfo.swapData,
            user.address, // to
            priceSpec
        );

        const events = (await tx.wait()).events || [];
        const createdEvent = events.find((e) => e.event === "DCACreated");
        const dcaId = createdEvent.args.dcaId;
        expect(dcaId).to.not.be.undefined;
        expect(createdEvent.args.user).to.equal(user.address);
        expect(createdEvent.args.to).to.equal(user.address);
        expect(createdEvent.args.amount).to.equal(usdcUnits('100'));
        expect(createdEvent.args.period).to.equal(7*day);

        // confirm initial DCA was processed
        expect(await userVault.currentValueOf(user.address)).to.be.closeTo(usdcUnits('900'), usdcUnits('1'));
        expect(await abc.balanceOf(user.address)).to.be.closeTo(parseUnits('99.70', 18), parseUnits('1', 18));

        await advanceTimeRunDCAKeeper(9, day);

        // confirm second DCA was processed
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(await userVault.currentValueOf(user.address)).to.be.closeTo(usdcUnits('800'), usdcUnits('1'));
        expect(await abc.balanceOf(user.address)).to.be.closeTo(parseUnits('199.40', 18), parseUnits('1', 18));

        await advanceTimeRunDCAKeeper(7, day);

        // confirm third DCA was processed
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(await userVault.currentValueOf(user.address)).to.be.closeTo(usdcUnits('700'), usdcUnits('1'));
        expect(await abc.balanceOf(user.address)).to.be.closeTo(parseUnits('299.10', 18), parseUnits('1', 18));

    });

    it("DCA with DAI maxPrice goes above using LP price", async function () {

        const {
            networkAddresses,
            user,
            vault,
            router,
            dca,
            dcaManifest,
        } = await dcaWithLiquidityFixtureNoPricefeed();

        const userVault = vault.connect(user);
        const userDCA = dca.connect(user);


        // deposit to vault
        await userVault.deposit(networkAddresses.DAI, daiUnits('100'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('100'));

        const assetInfo = dcaManifest.assets.find((a) => a.inputAssetSymbol === 'DAI' && a.outputAssetSymbol === 'ABC');
        const assetSpec = CaskSDK.utils.dcaAssetspec(assetInfo);
        const merkleProof = CaskSDK.utils.dcaMerkleProof(dcaManifest.assets, assetInfo);
        const priceSpec = CaskSDK.utils.dcaPricespec(
            7 * day, // period
            usdcUnits('10'), // amount
            0, // totalAmount
            100, // maxSlippageBps
            0, // minPrice
            parseUnits('1.1', 18) // maxPrice
        );

        let result;

        // create DCA
        const tx = await userDCA.createDCA(
            assetSpec, // assetSpec
            merkleProof, // merkleProof
            assetInfo.swapProtocol,
            assetInfo.swapData,
            user.address, // to
            priceSpec
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
        expect(await userVault.currentValueOf(user.address)).to.be.closeTo(usdcUnits('90'), usdcUnits('0.02'));
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(result.numSkips).to.equal(0);

        // change price of ABC so its no longer in range
        await router.setOutputBps(5000);  // set ABC price in LP to 2 USDC - below minPrice

        await advanceTimeRunDCAKeeper(9, day);

        // confirm second DCA was skipped
        result = await userDCA.getDCA(dcaId);
        expect(result.status).to.equal(CaskSDK.dcaStatus.ACTIVE);
        expect(result.numSkips).to.equal(1);
        expect(await userVault.currentValueOf(user.address)).to.be.closeTo(usdcUnits('89.9'), usdcUnits('0.02'));  // minus minFee
    });

    it("DCA with DAI minPrice not met using LP price", async function () {

        const {
            networkAddresses,
            user,
            vault,
            dca,
            dcaManifest,
        } = await dcaWithLiquidityFixtureNoPricefeed();

        const userVault = vault.connect(user);
        const userDCA = dca.connect(user);


        // deposit to vault
        await userVault.deposit(networkAddresses.DAI, daiUnits('100'));

        // check initial balance
        const initialUserBalance = await userVault.currentValueOf(user.address);
        expect(initialUserBalance).to.equal(usdcUnits('100'));

        const assetInfo = dcaManifest.assets.find((a) => a.inputAssetSymbol === 'DAI' && a.outputAssetSymbol === 'ABC');
        const assetSpec = CaskSDK.utils.dcaAssetspec(assetInfo);
        const merkleProof = CaskSDK.utils.dcaMerkleProof(dcaManifest.assets, assetInfo);
        const priceSpec = CaskSDK.utils.dcaPricespec(
            7 * day, // period
            usdcUnits('10'), // amount
            0, // totalAmount
            100, // maxSlippageBps
            parseUnits('2', 18), // minPrice
            0 // maxPrice
        );

        // try and create DCA with minPrice above current price (1 USDC)
        await expect(userDCA.createDCA(
            assetSpec, // assetSpec
            merkleProof, // merkleProof
            assetInfo.swapProtocol,
            assetInfo.swapData,
            user.address, // to
            priceSpec
        )).to.be.revertedWith("!UNPROCESSABLE");

    });

});
