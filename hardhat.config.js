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


// production deployer
const DEPLOYER = "0x54812dBaB593674CD4F1216264895be48B55C5e3";

// production networks - each chain has their own governor/strategist (multisigs)
const MAINNET_GOVERNOR = "0xCaf497e32B5446530ea52647ee997602222AD1E4";
const POLYGON_GOVERNOR = "0x0c91Ec7D8D74A7AffFEe0a53d4447C5b8807F305";
const POLYGON_STRATEGIST = "0x0c91Ec7D8D74A7AffFEe0a53d4447C5b8807F305";
const POLYGON_KEEPER = "0x";

// testnet networks - common across all testnets
const TESTNET_DEPLOYER = "0x83e50cD4123bAA60f6d6c8A83ca85Ac72e826bD0";
const TESTNET_GOVERNOR = "0x4486EDD9E810062675163ffe32ed70fD52191541";
const TESTNET_STRATEGIST = "0x4776e69279A0d500537A5d2241d6fF3189442690";
const TESTNET_FAUCET_ADMIN = "0xaA411e7F2daE036f4f75D0a4c21dbCb074641064";
const TESTNET_KEEPER = "0x34F7C3f7D5354820433162D79aa3C505b612837d";


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
    .addOptionalParam("limit", "Max subscriptions to process per run", "4")
    .addOptionalParam("minDepth", "Only run keeper if queue is at least this deep", "0")
    .addOptionalParam("queue", "comma separated list of queues - 1 for active queue, 2 for past due queue", "1,2")
    .addOptionalParam("interval", "How often (in ms) to do keeper upkeep check", "30000")
    .addOptionalParam("gasLimit", "gasLimit for keeper transaction", "2500000")
    .setAction(keeper);

module.exports = {
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
    kovan: {
      url: `${process.env.KOVAN_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.KOVAN_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gas: 2100000, gasPrice: 8000000000,
    },
    rinkeby: {
      url: `${process.env.RINKEBY_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.RINKEBY_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gas: 2100000, gasPrice: 8000000000,
    },
    mainnet: {
      url: `${process.env.MAINNET_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.MAINNET_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      gasPrice: 55000000000, // TODO: make sure to set to appropriate gwei!
      timeout: 900000,
    },
    production_polygon: {
      url: `${process.env.POLYGON_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.POLYGON_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
    },
    internal_mumbai: {
      url: `${process.env.MUMBAI_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.INTERNAL_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gas: 2100000, gasPrice: 8000000000,
    },
    testnet_mumbai: {
      url: `${process.env.MUMBAI_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.MUMBAI_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gas: 2100000, gasPrice: 8000000000,
    },
    testnet_fantom: {
      url: `${process.env.FTMTESTNET_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.FTMTESTNET_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gas: 2100000, gasPrice: 210000000000,
    },
    testnet_fuji: {
      url: `${process.env.FUJI_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.FUJI_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gas: 2100000, gasPrice: 26000000000,
    },
  },
  namedAccounts: {
    deployerAddr: {
      mainnet: DEPLOYER,
      production_polygon: DEPLOYER,

      default: 0,
      localhost: 0,
      kovan: TESTNET_DEPLOYER,
      rinkeby: TESTNET_DEPLOYER,
      internal_mumbai: TESTNET_DEPLOYER,
      testnet_mumbai: TESTNET_DEPLOYER,
      testnet_fantom: TESTNET_DEPLOYER,
      testnet_fuji: TESTNET_DEPLOYER,
    },
    governorAddr: {
      mainnet: MAINNET_GOVERNOR,
      production_polygon: POLYGON_GOVERNOR,

      default: 1,
      localhost: process.env.FORK === "true" ? POLYGON_GOVERNOR : 1,
      hardhat: process.env.FORK === "true" ? POLYGON_GOVERNOR : 1,
      kovan: TESTNET_GOVERNOR,
      rinkeby: TESTNET_GOVERNOR,
      internal_mumbai: TESTNET_GOVERNOR,
      testnet_mumbai: TESTNET_GOVERNOR,
      testnet_fantom: TESTNET_GOVERNOR,
      testnet_fuji: TESTNET_GOVERNOR,
    },
    strategistAddr: {
      production_polygon: POLYGON_STRATEGIST,

      default: 2,
      localhost: process.env.FORK === "true" ? POLYGON_STRATEGIST : 2,
      hardhat: process.env.FORK === "true" ? POLYGON_STRATEGIST : 2,
      internal_mumbai: TESTNET_STRATEGIST,
      testnet_mumbai: TESTNET_STRATEGIST,
      testnet_fantom: TESTNET_STRATEGIST,
      testnet_fuji: TESTNET_STRATEGIST,
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
      testnet_mumbai: TESTNET_FAUCET_ADMIN,
      testnet_fantom: TESTNET_FAUCET_ADMIN,
      testnet_fuji: TESTNET_FAUCET_ADMIN,
    },
    keeperAddr: {
      production_polygon: POLYGON_KEEPER,

      default: 11,
      localhost: process.env.FORK === "true" ? POLYGON_KEEPER : 11,
      hardhat: process.env.FORK === "true" ? POLYGON_KEEPER : 11,
      internal_mumbai: TESTNET_KEEPER,
      testnet_mumbai: TESTNET_KEEPER,
      testnet_fantom: TESTNET_KEEPER,
      testnet_fuji: TESTNET_KEEPER,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      kovan: process.env.ETHERSCAN_API_KEY,
      rinkeby: process.env.ETHERSCAN_API_KEY,
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
