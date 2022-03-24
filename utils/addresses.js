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
addresses.production_polygon.WETH = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";

// Chainlink feeds
// Source https://docs.chain.link/docs/ethereum-addresses
addresses.production_polygon.DAI_USD = "0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D";
addresses.production_polygon.USDC_USD = "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7";
addresses.production_polygon.USDT_USD = "0x0A6513e40db6EB1b165753AD52E80663aeA50545";
addresses.production_polygon.WETH_USD = "0xF9680D99D6C9589e2a93a78A04A279e509205945";

addresses.production_polygon.Owner = "0x"; // dao multisig
addresses.production_polygon.VaultProxy = "0x";
addresses.production_polygon.Vault = "0x";


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
