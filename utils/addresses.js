const addresses = {};

// Utility addresses
addresses.zero = "0x0000000000000000000000000000000000000000";
addresses.dead = "0x0000000000000000000000000000000000000001";


/* mainnet addresses */
addresses.mainnet = {};


/* polygon addresses */
addresses.production_polygon = {};

// Native stablecoins
addresses.production_polygon.DAI = "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063";
addresses.production_polygon.USDC = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
addresses.production_polygon.USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
addresses.production_polygon.UST = "0xe6469ba6d2fd6130788e0ea9c0a0515900563b59"
addresses.production_polygon.WETH = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";


// Chainlink feeds
// Source https://docs.chain.link/docs/ethereum-addresses
addresses.production_polygon.DAI_USD = "0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D";
addresses.production_polygon.USDC_USD = "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7";
addresses.production_polygon.USDT_USD = "0x0A6513e40db6EB1b165753AD52E80663aeA50545";
addresses.production_polygon.UST_USD = "0x2D455E55e8Ad3BA965E3e95e7AaB7dF1C671af19";
addresses.production_polygon.WETH_USD = "0xF9680D99D6C9589e2a93a78A04A279e509205945";

addresses.production_polygon.Owner = "0x"; // dao multisig
addresses.production_polygon.VaultProxy = "0x";
addresses.production_polygon.Vault = "0x";



/* avalanche addresses */
addresses.production_avalanche = {};

// Native stablecoins
addresses.production_avalanche.DAI = "0xd586e7f844cea2f87f50152665bcbc2c279d8d70";
addresses.production_avalanche.USDC = "0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664";
addresses.production_avalanche.USDT = "0xc7198437980c041c805a1edcba50c1ce5db95118";
addresses.production_avalanche.UST = "0xb599c3590f42f8f995ecfa0f85d2980b76862fc1"
addresses.production_avalanche.WETH = "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab";


// Chainlink feeds
// Source https://docs.chain.link/docs/ethereum-addresses
addresses.production_avalanche.DAI_USD = "0x51D7180edA2260cc4F6e4EebB82FEF5c3c2B8300";
addresses.production_avalanche.USDC_USD = "0xF096872672F44d6EBA71458D74fe67F9a77a23B9";
addresses.production_avalanche.USDT_USD = "0xEBE676ee90Fe1112671f19b6B7459bC678B67e8a";
addresses.production_avalanche.UST_USD = "0xf58B78581c480caFf667C63feDd564eCF01Ef86b";
addresses.production_avalanche.WETH_USD = "0x976B3D034E162d8bD72D6b9C989d545b839003b0";


/* fantom addresses */
addresses.production_fantom = {};

// Native stablecoins
addresses.production_fantom.DAI = "0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e";
addresses.production_fantom.USDC = "0x04068da6c83afcfa0e13ba15a6696662335d5b75";
addresses.production_fantom.USDT = "0x049d68029688eabf473097a2fc38ef61633a3c7a";
addresses.production_fantom.UST = "0x846e4d51d7e2043c1a87e0ab7490b93fb940357b"
addresses.production_fantom.WETH = "0x74b23882a30290451A17c44f4F05243b6b58C76d";


// Chainlink feeds
// Source https://docs.chain.link/docs/ethereum-addresses
addresses.production_fantom.DAI_USD = "0x91d5DEFAFfE2854C7D02F50c80FA1fdc8A721e52";
addresses.production_fantom.USDC_USD = "0x2553f4eeb82d5A26427b8d1106C51499CBa5D99c";
addresses.production_fantom.USDT_USD = "0xF64b636c5dFe1d3555A847341cDC449f612307d0";
addresses.production_fantom.UST_USD = "0x6F3DD0eC672871547Ea495DCF7aA963B8A179287";
addresses.production_fantom.WETH_USD = "0x11DdD3d147E5b83D01cee7070027092397d63658";




/* mumbai addresses */
addresses.testnet_mumbai = {};
// addresses.testnet_mumbai.DAI_USD = "0x0FCAa9c899EC5A91eBc3D5Dd869De833b06fB046";
// addresses.testnet_mumbai.USDC_USD = "0x572dDec9087154dC5dfBB1546Bb62713147e0Ab0";
addresses.testnet_mumbai.USDT_USD = "0x92C09849638959196E976289418e5973CC96d645";
addresses.testnet_mumbai.WETH_USD = "0x0715A7794a1dc8e42615F059dD6e406A6594651A";


/* fantom testnet addresses */
addresses.testnet_fantom = {};
addresses.testnet_fantom.USDT_USD = "0x9BB8A6dcD83E36726Cc230a97F1AF8a84ae5F128";
addresses.testnet_fantom.WETH_USD = "0xB8C458C957a6e6ca7Cc53eD95bEA548c52AFaA24";


/* avax/fuji testnet addresses */
addresses.testnet_fuji = {};
addresses.testnet_fuji.USDT_USD = "0x7898AcCC83587C3C55116c5230C17a6Cd9C71bad";
addresses.testnet_fuji.WETH_USD = "0x86d67c3D38D2bCeE722E601025C25a575021c6EA";



module.exports = addresses;
