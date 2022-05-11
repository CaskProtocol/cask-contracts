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
addresses.mainnet_polygon.UST = "0xe6469ba6d2fd6130788e0ea9c0a0515900563b59"
addresses.mainnet_polygon.FRAX = "0x45c32fa6df82ead1e2ef74d17b76547eddfaff89"


// Chainlink feeds (https://docs.chain.link/docs/ethereum-addresses)
addresses.mainnet_polygon.DAI_USD = "0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D";
addresses.mainnet_polygon.USDC_USD = "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7";
addresses.mainnet_polygon.USDT_USD = "0x0A6513e40db6EB1b165753AD52E80663aeA50545";
addresses.mainnet_polygon.UST_USD = "0x2D455E55e8Ad3BA965E3e95e7AaB7dF1C671af19";
addresses.mainnet_polygon.FRAX_USD = "0x00DBeB1e45485d53DF7C2F0dF1Aa0b6Dc30311d3";



/* avalanche addresses */
addresses.mainnet_avalanche = {};

// Native stablecoins
addresses.mainnet_avalanche.DAI = "0xd586e7f844cea2f87f50152665bcbc2c279d8d70";
addresses.mainnet_avalanche.USDC = "0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664";
addresses.mainnet_avalanche.USDT = "0xc7198437980c041c805a1edcba50c1ce5db95118";
addresses.mainnet_avalanche.UST = "0xb599c3590f42f8f995ecfa0f85d2980b76862fc1"
addresses.mainnet_avalanche.FRAX = "0xd24c2ad096400b6fbcd2ad8b24e7acbc21a1da64"


// Chainlink feeds (https://docs.chain.link/docs/ethereum-addresses)
addresses.mainnet_avalanche.DAI_USD = "0x51D7180edA2260cc4F6e4EebB82FEF5c3c2B8300";
addresses.mainnet_avalanche.USDC_USD = "0xF096872672F44d6EBA71458D74fe67F9a77a23B9";
addresses.mainnet_avalanche.USDT_USD = "0xEBE676ee90Fe1112671f19b6B7459bC678B67e8a";
addresses.mainnet_avalanche.UST_USD = "0xf58B78581c480caFf667C63feDd564eCF01Ef86b";
addresses.mainnet_avalanche.FRAX_USD = "0xbBa56eF1565354217a3353a466edB82E8F25b08e";


/* fantom addresses */
addresses.mainnet_fantom = {};

// Native stablecoins
addresses.mainnet_fantom.DAI = "0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e";
addresses.mainnet_fantom.USDC = "0x04068da6c83afcfa0e13ba15a6696662335d5b75";
addresses.mainnet_fantom.USDT = "0x049d68029688eabf473097a2fc38ef61633a3c7a";
addresses.mainnet_fantom.UST = "0x846e4d51d7e2043c1a87e0ab7490b93fb940357b";
addresses.mainnet_fantom.FRAX = "0xdc301622e621166bd8e82f2ca0a26c13ad0be355";


// Chainlink feeds (https://docs.chain.link/docs/ethereum-addresses)
addresses.mainnet_fantom.DAI_USD = "0x91d5DEFAFfE2854C7D02F50c80FA1fdc8A721e52";
addresses.mainnet_fantom.USDC_USD = "0x2553f4eeb82d5A26427b8d1106C51499CBa5D99c";
addresses.mainnet_fantom.USDT_USD = "0xF64b636c5dFe1d3555A847341cDC449f612307d0";
addresses.mainnet_fantom.UST_USD = "0x6F3DD0eC672871547Ea495DCF7aA963B8A179287";
addresses.mainnet_fantom.FRAX_USD = "0xBaC409D670d996Ef852056f6d45eCA41A8D57FbD";



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



module.exports = addresses;
