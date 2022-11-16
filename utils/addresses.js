const addresses = {};

// Utility addresses
addresses.zero = "0x0000000000000000000000000000000000000000";
addresses.dead = "0x0000000000000000000000000000000000000001";


/* mainnet addresses */
addresses.mainnet = {};


/* polygon addresses */
addresses.mainnet_polygon = {};

// Native stablecoins
addresses.mainnet_polygon.DAI = "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063";
addresses.mainnet_polygon.USDC = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
addresses.mainnet_polygon.USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
addresses.mainnet_polygon.FRAX = "0x45c32fa6df82ead1e2ef74d17b76547eddfaff89"


// Chainlink feeds (https://docs.chain.link/docs/ethereum-addresses)
addresses.mainnet_polygon.DAI_USD = "0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D";
addresses.mainnet_polygon.USDC_USD = "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7";
addresses.mainnet_polygon.USDT_USD = "0x0A6513e40db6EB1b165753AD52E80663aeA50545";
addresses.mainnet_polygon.FRAX_USD = "0x00DBeB1e45485d53DF7C2F0dF1Aa0b6Dc30311d3";

addresses.mainnet_polygon.ERC20LINK = "0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39";
addresses.mainnet_polygon.ERC677LINK = "0xb0897686c545045aFc77CF20eC7A532E3120E0F1";
addresses.mainnet_polygon.LINK_USD = "0xd9FFdb71EbE7496cC440152d43986Aae0AB76665";
addresses.mainnet_polygon.link_swap_router = "0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff";
addresses.mainnet_polygon.link_swap_path = [
    "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
    "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
    "0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39"
];
addresses.mainnet_polygon.link_peg_swap = "0xAA1DC356dc4B18f30C347798FD5379F3D77ABC5b";


/* avalanche addresses */
addresses.mainnet_avalanche = {};

// Native stablecoins
addresses.mainnet_avalanche.DAI = "0xd586e7f844cea2f87f50152665bcbc2c279d8d70";
addresses.mainnet_avalanche.USDC = "0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664";
addresses.mainnet_avalanche.USDT = "0xc7198437980c041c805a1edcba50c1ce5db95118";
addresses.mainnet_avalanche.FRAX = "0xd24c2ad096400b6fbcd2ad8b24e7acbc21a1da64"

addresses.mainnet_avalanche.ERC20LINK = "0x0000000000000000000000000000000000000000";
addresses.mainnet_avalanche.ERC677LINK = "0x5947BB275c521040051D82396192181b413227A3";
addresses.mainnet_avalanche.LINK_USD = "0x49ccd9ca821EfEab2b98c60dC60F518E765EDe9a";
addresses.mainnet_avalanche.link_swap_router = "0x60ae616a2155ee3d9a68541ba4544862310933d4";
addresses.mainnet_avalanche.link_swap_path = [
    "0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664",
    "0x5947BB275c521040051D82396192181b413227A3"
];
addresses.mainnet_avalanche.link_peg_swap = "0x0000000000000000000000000000000000000000";


// Chainlink feeds (https://docs.chain.link/docs/ethereum-addresses)
addresses.mainnet_avalanche.DAI_USD = "0x51D7180edA2260cc4F6e4EebB82FEF5c3c2B8300";
addresses.mainnet_avalanche.USDC_USD = "0xF096872672F44d6EBA71458D74fe67F9a77a23B9";
addresses.mainnet_avalanche.USDT_USD = "0xEBE676ee90Fe1112671f19b6B7459bC678B67e8a";
addresses.mainnet_avalanche.FRAX_USD = "0xbBa56eF1565354217a3353a466edB82E8F25b08e";


/* fantom addresses */
addresses.mainnet_fantom = {};
addresses.mainnet_fantom.USDC = "0x04068da6c83afcfa0e13ba15a6696662335d5b75";
addresses.mainnet_fantom.USDC_USD = "0x2553f4eeb82d5A26427b8d1106C51499CBa5D99c";

/* celo addresses */
addresses.mainnet_celo = {};
addresses.mainnet_celo.USDC = "0x37f750b7cc259a2f741af45294f6a16572cf5cad";
addresses.mainnet_celo.USDC_USD = "0xDA7a001b254CD22e46d3eAB04d937489c93174C3"; // band StdReferenceProxy
addresses.mainnet_celo.USDC_PRICE_FEED_TYPE = 1; // celo uses band protocol oracles

/* aurora addresses */
addresses.mainnet_aurora = {};
addresses.mainnet_aurora.USDC = "0xb12bfca5a55806aaf64e99521918a4bf0fc40802";
addresses.mainnet_aurora.USDC_USD = "0x06b35392094610C8D21FB2409855e231869B287F"; // flux price feed

/* moonbeam addresses */
addresses.mainnet_moonbeam = {};
addresses.mainnet_moonbeam.USDC = "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b";
addresses.mainnet_moonbeam.USDC_USD = "0xA122591F60115D63421f66F752EF9f6e0bc73abC";

/* gnosis addresses */
addresses.mainnet_gnosis = {};
addresses.mainnet_gnosis.USDC = "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83";
addresses.mainnet_gnosis.USDC_USD = "0x26C31ac71010aF62E6B486D1132E266D6298857D";

/* bsc addresses */
addresses.mainnet_bsc = {};
addresses.mainnet_bsc.USDC = "0x672147dd47674757c457eb155baa382cc10705dd";
addresses.mainnet_bsc.USDC_USD = "0x51597f405303C4377E36123cBc172b13269EA163";

/* arbitrum addresses */
addresses.mainnet_arbitrum = {};
addresses.mainnet_arbitrum.USDC = "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8";
addresses.mainnet_arbitrum.USDC_USD = "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3";

addresses.mainnet_arbitrum.ERC20LINK = "0x0000000000000000000000000000000000000000";
addresses.mainnet_arbitrum.ERC677LINK = "0xf97f4df75117a78c1a5a0dbb814af92458539fb4";
addresses.mainnet_arbitrum.LINK_USD = "0x86E53CF1B870786351Da77A57575e79CB55812CB";
addresses.mainnet_arbitrum.link_swap_router = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
addresses.mainnet_arbitrum.link_swap_path = [
    "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
    "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    "0xf97f4df75117a78c1a5a0dbb814af92458539fb4"
];
addresses.mainnet_arbitrum.link_peg_swap = "0x0000000000000000000000000000000000000000";


/* optimism addresses */
addresses.mainnet_optimism = {};
addresses.mainnet_optimism.USDC = "0x7f5c764cbc14f9669b88837ca1490cca17c31607";
addresses.mainnet_optimism.USDC_USD = "0x16a9FA2FDa030272Ce99B29CF780dFA30361E0f3";



/******* TESTNET ADDRESSES *********/

/* mumbai testnet addresses */
addresses.testnet_mumbai = {};
addresses.testnet_mumbai.DAI_USD = "0x0FCAa9c899EC5A91eBc3D5Dd869De833b06fB046";
addresses.testnet_mumbai.USDC_USD = "0x572dDec9087154dC5dfBB1546Bb62713147e0Ab0";
addresses.testnet_mumbai.USDT_USD = "0x92C09849638959196E976289418e5973CC96d645";

/* fantom testnet addresses */
addresses.testnet_fantom = {};
addresses.testnet_fantom.USDT_USD = "0x9BB8A6dcD83E36726Cc230a97F1AF8a84ae5F128";

/* avax/fuji testnet addresses */
addresses.testnet_fuji = {};
addresses.testnet_fuji.USDT_USD = "0x7898AcCC83587C3C55116c5230C17a6Cd9C71bad";
addresses.testnet_fuji.ERC677LINK = "0x0b9d5d9136855f6fec3c0993fee6e9ce8a297846";
addresses.testnet_fuji.LINK_USD = "0x34C4c526902d88a3Aa98DB8a9b802603EB1E3470";
addresses.testnet_fuji.link_swap_router = "0xd7f655e3376ce2d7a2b08ff01eb3b1023191a901";

/* alfajores testnet addresses */
addresses.testnet_alfajores = {};




/******* INTERNAL ADDRESSES *********/

/* mumbai internal addresses */
addresses.internal_mumbai = {};
// addresses.internal_mumbai.DAI_USD = "0x0FCAa9c899EC5A91eBc3D5Dd869De833b06fB046";
// addresses.internal_mumbai.USDC_USD = "0x572dDec9087154dC5dfBB1546Bb62713147e0Ab0";
addresses.internal_mumbai.USDT_USD = "0x92C09849638959196E976289418e5973CC96d645";

/* avax/fuji internal addresses */
addresses.internal_fuji = {};
addresses.internal_fuji.USDT_USD = "0x7898AcCC83587C3C55116c5230C17a6Cd9C71bad";
addresses.internal_fuji.ERC677LINK = "0x0b9d5d9136855f6fec3c0993fee6e9ce8a297846";
addresses.internal_fuji.LINK_USD = "0x34C4c526902d88a3Aa98DB8a9b802603EB1E3470";
addresses.internal_fuji.link_swap_router = "0xd7f655e3376ce2d7a2b08ff01eb3b1023191a901";


module.exports = addresses;
