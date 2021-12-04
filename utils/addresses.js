const addresses = {};

// Utility addresses
addresses.zero = "0x0000000000000000000000000000000000000000";
addresses.dead = "0x0000000000000000000000000000000000000001";


/* mainnet addresses */
addresses.mainnet = {};


/* polygon addresses */
addresses.polygon = {};

// Native stablecoins
addresses.polygon.DAI = "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063";
addresses.polygon.USDC = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
addresses.polygon.USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
addresses.polygon.WETH = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";

// Chainlink feeds
// Source https://docs.chain.link/docs/ethereum-addresses
addresses.polygon.DAI_USD = "0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D";
addresses.polygon.USDC_USD = "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7";
addresses.polygon.USDT_USD = "0x0A6513e40db6EB1b165753AD52E80663aeA50545";
addresses.polygon.WETH_USD = "0xF9680D99D6C9589e2a93a78A04A279e509205945";

addresses.polygon.Owner = "0x"; // dao multisig
addresses.polygon.VaultProxy = "0x";
addresses.polygon.Vault = "0x";


/* mumbai addresses */
addresses.mumbai = {};

// Chainlink feeds
// Source https://docs.chain.link/docs/ethereum-addresses
addresses.mumbai.DAI_USD = "0x0FCAa9c899EC5A91eBc3D5Dd869De833b06fB046";
addresses.mumbai.USDC_USD = "0x572dDec9087154dC5dfBB1546Bb62713147e0Ab0";
addresses.mumbai.USDT_USD = "0x92C09849638959196E976289418e5973CC96d645";
addresses.mumbai.WETH_USD = "0x0715A7794a1dc8e42615F059dD6e406A6594651A";


module.exports = addresses;
