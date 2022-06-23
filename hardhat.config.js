const ethers = require("ethers");

require("dotenv").config();

require("@nomiclabs/hardhat-waffle");
require('@openzeppelin/hardhat-upgrades');
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-web3");
require('hardhat-deploy');
require('hardhat-contract-sizer');


const { accounts } = require("./tasks/account");
const { debug } = require("./tasks/debug");
const { fund } = require("./tasks/fund");
const { fixtures } = require("./tasks/fixtures");
const { keeper } = require("./tasks/keeper");
const { dcaMerkleRoot, dcaLiquidity } = require("./tasks/dca");


// production
const DEPLOYER = "0x54812dBaB593674CD4F1216264895be48B55C5e3";
const KEEPER = "0xa942e8a09dF292Ef66F3d02755E5B5AB04b90709";

// production networks - each chain has their own governor/strategist (multisigs)
const ETHEREUM_GOVERNOR = "0xCaf497e32B5446530ea52647ee997602222AD1E4";

const POLYGON_GOVERNOR = "0x0c91Ec7D8D74A7AffFEe0a53d4447C5b8807F305";
const POLYGON_STRATEGIST = "0x0c91Ec7D8D74A7AffFEe0a53d4447C5b8807F305";

const AVALANCHE_GOVERNOR = "0x65cf6394de068ca0301044f3bad050d925bA3Cfa";
const AVALANCHE_STRATEGIST = "0x65cf6394de068ca0301044f3bad050d925bA3Cfa";

const FANTOM_GOVERNOR = "";
const FANTOM_STRATEGIST = "";


// testnet networks - common across all testnets
const TESTNET_DEPLOYER = "0x83e50cD4123bAA60f6d6c8A83ca85Ac72e826bD0";
const TESTNET_GOVERNOR = "0x4486EDD9E810062675163ffe32ed70fD52191541";
const TESTNET_STRATEGIST = "0x4776e69279A0d500537A5d2241d6fF3189442690";
const TESTNET_FAUCET_ADMIN = "0xaA411e7F2daE036f4f75D0a4c21dbCb074641064";
const TESTNET_KEEPER = "0xEE726C8260c5644fDA0d670c154D52800bcFF5aC";


const mnemonic =
    "dolphin capable patient jump first clip argue wink upon kiss bring laundry";

let privateKeys = [];

let derivePath = "m/44'/60'/0'/0/";
for (let i = 0; i < 15; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `${derivePath}${i}`);
  privateKeys.push(wallet.privateKey);
}


task("debug", "Print info about contracts and their configs", debug);

task("accounts", "Prints the list of accounts", async (taskArguments, hre) => {
  return accounts(taskArguments, hre, privateKeys);
});

task("fund", "Funds all accounts with USDC/USDT/DAI", fund);

task("fixtures", "Setup fixtured provider plans and consumer subscriptions", fixtures);

task("keeper", "Run a keeper")
    .addOptionalParam("protocol", "Protocol to upkeep: One of 'subscriptions', 'dca' or 'p2p'", "subscriptions")
    .addOptionalParam("limit", "Max work items to process per run", "4")
    .addOptionalParam("minDepth", "Only run keeper if queue is at least this deep", "0")
    .addOptionalParam("queue", "comma separated list of queues", "1")
    .addOptionalParam("interval", "How often (in ms) to do keeper upkeep check", "30000")
    .addOptionalParam("gasLimit", "gasLimit for keeper transaction", "2500000")
    .addOptionalParam("gasPrice", "gasPrice for keeper transaction")
    .setAction(keeper);

task("dca:merkleroot", "Generate merkle root for DCA asset list")
    .addOptionalParam("execute", "Update on-chain merkle root", "false")
    .setAction(dcaMerkleRoot);

task("dca:liquidity", "Add liquidity to the mock uniswap router for DCA swaps", dcaLiquidity);

module.exports = {
  mocha: {
    timeout: 600000
  },
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
      },
    }
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic,
      },
      chainId: 31337,
      initialBaseFeePerGas: 0,
    },
    localhost: {
      timeout: 60000,
    },
    ethereum: {
      url: `${process.env.ETHEREUM_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.ETHEREUM_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      gasPrice: parseInt(process.env.ETHEREUM_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
      timeout: 900000,
    },
    mainnet_polygon: {
      url: `${process.env.POLYGON_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.POLYGON_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      gasPrice: parseInt(process.env.POLYGON_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
      timeout: 900000,
    },
    mainnet_avalanche: {
      url: `${process.env.AVALANCHE_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.AVALANCHE_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.AVALANCHE_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    mainnet_fantom: {
      url: `${process.env.FANTOM_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.FANTOM_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.FANTOM_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    internal_mumbai: {
      url: `${process.env.MUMBAI_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.INTERNAL_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gas: 2100000,
      gasPrice: parseInt(process.env.MUMBAI_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    testnet_mumbai: {
      url: `${process.env.MUMBAI_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.MUMBAI_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gas: 2100000,
      gasPrice: parseInt(process.env.MUMBAI_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    testnet_fantom: {
      url: `${process.env.FTMTESTNET_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.FTMTESTNET_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gas: 2100000,
      gasPrice: parseInt(process.env.FTMTESTNET_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    testnet_fuji: {
      url: `${process.env.FUJI_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.FUJI_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gas: 2100000,
      gasPrice: parseInt(process.env.FUJI_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    testnet_evmos: {
      url: `${process.env.EVMOSTESTNET_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.EVMOSTESTNET_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.EVMOSTESTNET_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    testnet_alfajores: {
      url: `${process.env.ALFAJORES_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.ALFAJORES_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.ALFAJORES_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    testnet_aurora: {
      url: `${process.env.AURORATESTNET_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.AURORATESTNET_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.AURORA_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    internal_fuji: {
      url: `${process.env.FUJI_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.INTERNAL_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gas: 2100000,
      gasPrice: parseInt(process.env.FUJI_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
  },
  namedAccounts: {
    deployerAddr: {
      ethereum: DEPLOYER,
      mainnet_polygon: DEPLOYER,
      mainnet_avalanche: DEPLOYER,
      mainnet_fantom: DEPLOYER,

      default: 0,
      localhost: 0,
      internal_mumbai: TESTNET_DEPLOYER,
      internal_fuji: TESTNET_DEPLOYER,
      testnet_mumbai: TESTNET_DEPLOYER,
      testnet_fantom: TESTNET_DEPLOYER,
      testnet_fuji: TESTNET_DEPLOYER,
      testnet_alfajores: TESTNET_DEPLOYER,
      testnet_evmos: TESTNET_DEPLOYER,
      testnet_aurora: TESTNET_DEPLOYER,
    },
    governorAddr: {
      ethereum: ETHEREUM_GOVERNOR,
      mainnet_polygon: POLYGON_GOVERNOR,
      mainnet_avalanche: AVALANCHE_GOVERNOR,
      mainnet_fantom: FANTOM_GOVERNOR,

      default: 1,
      localhost: process.env.FORK === "true" ? POLYGON_GOVERNOR : 1,
      hardhat: process.env.FORK === "true" ? POLYGON_GOVERNOR : 1,
      internal_mumbai: TESTNET_GOVERNOR,
      internal_fuji: TESTNET_GOVERNOR,
      testnet_mumbai: TESTNET_GOVERNOR,
      testnet_fantom: TESTNET_GOVERNOR,
      testnet_fuji: TESTNET_GOVERNOR,
      testnet_alfajores: TESTNET_GOVERNOR,
      testnet_evmos: TESTNET_GOVERNOR,
      testnet_aurora: TESTNET_GOVERNOR,
    },
    strategistAddr: {
      mainnet_polygon: POLYGON_STRATEGIST,
      mainnet_avalanche: AVALANCHE_STRATEGIST,
      mainnet_fantom: FANTOM_STRATEGIST,

      default: 2,
      localhost: process.env.FORK === "true" ? POLYGON_STRATEGIST : 2,
      hardhat: process.env.FORK === "true" ? POLYGON_STRATEGIST : 2,
      internal_mumbai: TESTNET_STRATEGIST,
      internal_fuji: TESTNET_STRATEGIST,
      testnet_mumbai: TESTNET_STRATEGIST,
      testnet_fantom: TESTNET_STRATEGIST,
      testnet_fuji: TESTNET_STRATEGIST,
      testnet_alfajores: TESTNET_STRATEGIST,
      testnet_evmos: TESTNET_STRATEGIST,
      testnet_aurora: TESTNET_STRATEGIST,
    },
    consumerA: {
      default: 4
    },
    consumerB: {
      default: 5
    },
    consumerC: {
      default: 6
    },
    providerA: {
      default: 7
    },
    providerB: {
      default: 8
    },
    providerC: {
      default: 9
    },
    faucetAdmin: {
      default: 10,
      localhost: process.env.FORK === "true" ? TESTNET_FAUCET_ADMIN : 10,
      hardhat: process.env.FORK === "true" ? TESTNET_FAUCET_ADMIN : 10,
      internal_mumbai: TESTNET_FAUCET_ADMIN,
      internal_fuji: TESTNET_FAUCET_ADMIN,
      testnet_mumbai: TESTNET_FAUCET_ADMIN,
      testnet_fantom: TESTNET_FAUCET_ADMIN,
      testnet_fuji: TESTNET_FAUCET_ADMIN,
      testnet_alfajores: TESTNET_FAUCET_ADMIN,
      testnet_evmos: TESTNET_FAUCET_ADMIN,
      testnet_aurora: TESTNET_FAUCET_ADMIN,
    },
    keeperAddr: {
      mainnet_polygon: KEEPER,
      mainnet_avalanche: KEEPER,
      mainnet_fantom: KEEPER,

      default: 11,
      localhost: process.env.FORK === "true" ? KEEPER : 11,
      hardhat: process.env.FORK === "true" ? KEEPER : 11,
      internal_mumbai: TESTNET_KEEPER,
      internal_fuji: TESTNET_KEEPER,
      testnet_mumbai: TESTNET_KEEPER,
      testnet_fantom: TESTNET_KEEPER,
      testnet_fuji: TESTNET_KEEPER,
      testnet_alfajores: TESTNET_KEEPER,
      testnet_evmos: TESTNET_KEEPER,
      testnet_aurora: TESTNET_KEEPER,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY,
      opera: process.env.FTMSCAN_API_KEY,
      ftmTestnet: process.env.FTMSCAN_API_KEY,
      avalanche: process.env.SNOWTRACE_API_KEY,
      avalancheFujiTestnet: process.env.SNOWTRACE_API_KEY,
    }
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
  },
};
