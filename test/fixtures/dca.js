const {
    usdcUnits,
} = require("../../utils/units");

const {
    fundedFixture,
} = require("./vault");

const { CaskSDK } = require("@caskprotocol/sdk");


async function dcaFixture() {
    const fixture = await fundedFixture();

    fixture.user = fixture.consumerA;
    fixture.dca = await ethers.getContract("CaskDCA");
    fixture.dcaManager = await ethers.getContract("CaskDCAManager");
    fixture.router = await ethers.getContract("MockUniswapRouter");
    fixture.priceFeed = await ethers.getContract("MockChainlinkOracleFeedABC");
    fixture.usdc = await ethers.getContract("MockUSDC");
    fixture.abc = await ethers.getContract("MockABC");

    await fixture.router.connect(fixture.governor).initialize([fixture.usdc.address], [fixture.abc.address]);

    return fixture;
}

async function dcaWithLiquidityFixture() {
    const fixture = await dcaFixture();

    await fixture.usdc.connect(fixture.deployer).mint(fixture.router.address, usdcUnits('100000.0'));
    await fixture.abc.connect(fixture.deployer).mint(fixture.router.address,
        hre.ethers.utils.parseUnits('100000.0', 18));

    fixture.dcaManifest = {
        assets:[
            {
                "inputAssetSymbol": "USDC",
                "outputAssetSymbol": "ABC",
                "routerName": "MockRouter",
                "router": fixture.router.address.toLowerCase(),
                "priceFeed": fixture.priceFeed.address.toLowerCase(),
                "path": [
                    fixture.usdc.address.toLowerCase(),
                    fixture.abc.address.toLowerCase()
                ],
                "chainId": 31337
            },
            {
                "inputAssetSymbol": "USDC",
                "outputAssetSymbol": "ZZZ",
                "routerName": "MockRouter",
                "router": fixture.router.address.toLowerCase(),
                "priceFeed": fixture.priceFeed.address.toLowerCase(),
                "path": [
                    fixture.usdc.address.toLowerCase(),
                    "0x1fA4E417Ed8B4497D0D1C73cb54C5e2704055Bf7"
                ],
                "chainId": 31337
            },
        ]
    }

    fixture.assetsMerkleRoot = CaskSDK.utils.dcaMerkleRoot(fixture.dcaManifest.assets);

    await fixture.dca.connect(fixture.governor).setAssetsMerkleRoot(fixture.assetsMerkleRoot);

    return fixture;
}

async function dcaWithLiquidityFixtureNoPricefeed() {
    const fixture = await dcaFixture();

    await fixture.usdc.connect(fixture.deployer).mint(fixture.router.address, usdcUnits('100000.0'));
    await fixture.abc.connect(fixture.deployer).mint(fixture.router.address,
        hre.ethers.utils.parseUnits('100000.0', 18));

    fixture.dcaManifest = {
        assets:[
            {
                "inputAssetSymbol": "USDC",
                "outputAssetSymbol": "ABC",
                "routerName": "MockRouter",
                "router": fixture.router.address.toLowerCase(),
                "priceFeed": "0x0000000000000000000000000000000000000000",
                "path": [
                    fixture.usdc.address.toLowerCase(),
                    fixture.abc.address.toLowerCase()
                ],
                "chainId": 31337
            },
            {
                "inputAssetSymbol": "USDC",
                "outputAssetSymbol": "ZZZ",
                "routerName": "MockRouter",
                "router": fixture.router.address.toLowerCase(),
                "priceFeed": "0x0000000000000000000000000000000000000000",
                "path": [
                    fixture.usdc.address.toLowerCase(),
                    "0x1fA4E417Ed8B4497D0D1C73cb54C5e2704055Bf7"
                ],
                "chainId": 31337
            },
        ]
    }

    fixture.assetsMerkleRoot = CaskSDK.utils.dcaMerkleRoot(fixture.dcaManifest.assets);

    await fixture.dca.connect(fixture.governor).setAssetsMerkleRoot(fixture.assetsMerkleRoot);

    return fixture;
}

module.exports = {
    dcaFixture,
    dcaWithLiquidityFixture,
    dcaWithLiquidityFixtureNoPricefeed,
}