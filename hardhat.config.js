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


// dao networks

const MAINNET_DEPLOYER = "0x54812dBaB593674CD4F1216264895be48B55C5e3";
const MAINNET_GOVERNOR = "0xCaf497e32B5446530ea52647ee997602222AD1E4";

const KOVAN_DEPLOYER = "0x83e50cD4123bAA60f6d6c8A83ca85Ac72e826bD0";
const KOVAN_GOVERNOR = "0x4486EDD9E810062675163ffe32ed70fD52191541";

const RINKEBY_DEPLOYER = "0x83e50cD4123bAA60f6d6c8A83ca85Ac72e826bD0";
const RINKEBY_GOVERNOR = "0x939Bb832cF8cfD720C746fE25f3d6632fB1442c3";

// protocol networks

const POLYGON_DEPLOYER = "0x54812dBaB593674CD4F1216264895be48B55C5e3";
const POLYGON_GOVERNOR = "0x0c91Ec7D8D74A7AffFEe0a53d4447C5b8807F305";
const POLYGON_STRATEGIST = "0x0c91Ec7D8D74A7AffFEe0a53d4447C5b8807F305";

const MUMBAI_DEPLOYER = "0x83e50cD4123bAA60f6d6c8A83ca85Ac72e826bD0";
const MUMBAI_GOVERNOR = "0x4486EDD9E810062675163ffe32ed70fD52191541";
const MUMBAI_STRATEGIST = "0x4776e69279A0d500537A5d2241d6fF3189442690";
const MUMBAI_FAUCET_ADMIN = "0xaA411e7F2daE036f4f75D0a4c21dbCb074641064";



const mnemonic =
    "dolphin capable patient jump first clip argue wink upon kiss bring laundry";

let privateKeys = [];

let derivePath = "m/44'/60'/0'/0/";
for (let i = 0; i < 10; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `${derivePath}${i}`);
  privateKeys.push(wallet.privateKey);
}


task("debug", "Print info about contracts and their configs", debug);

task("accounts", "Prints the list of accounts", async (taskArguments, hre) => {
  return accounts(taskArguments, hre, privateKeys);
});

task("fund", "Funds all the accounts", async (taskArguments, hre) => {
  return fund(taskArguments, hre, privateKeys);
});


module.exports = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 500000
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
        process.env.KOVAN_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gas: 2100000, gasPrice: 8000000000,
    },
    rinkeby: {
      url: `${process.env.RINKEBY_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.RINKEBY_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gas: 2100000, gasPrice: 8000000000,
    },
    mainnet: {
      url: `${process.env.MAINNET_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.MAINNET_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
    },
    polygon: {
      url: `${process.env.POLYGON_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.POLYGON_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
    },
    mumbai: {
      url: `${process.env.MUMBAI_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.MUMBAI_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gas: 2100000, gasPrice: 8000000000,
    },
  },
  namedAccounts: {
    deployerAddr: {
      default: 0,
      localhost: 0,
      mainnet: MAINNET_DEPLOYER,
      kovan: KOVAN_DEPLOYER,
      rinkeby: RINKEBY_DEPLOYER,
      polygon: POLYGON_DEPLOYER,
      mumbai: MUMBAI_DEPLOYER,
    },
    governorAddr: {
      default: 1,
      localhost: process.env.FORK === "true" ? POLYGON_GOVERNOR : 1,
      hardhat: process.env.FORK === "true" ? POLYGON_GOVERNOR : 1,
      mainnet: MAINNET_GOVERNOR,
      kovan: KOVAN_GOVERNOR,
      rinkeby: RINKEBY_GOVERNOR,
      polygon: POLYGON_GOVERNOR,
      mumbai: MUMBAI_GOVERNOR,
    },
    strategistAddr: {
      default: 2,
      localhost: process.env.FORK === "true" ? POLYGON_STRATEGIST : 2,
      hardhat: process.env.FORK === "true" ? POLYGON_STRATEGIST : 2,
      polygon: POLYGON_STRATEGIST,
      mumbai: MUMBAI_STRATEGIST,
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
      localhost: process.env.FORK === "true" ? MUMBAI_FAUCET_ADMIN : 10,
      hardhat: process.env.FORK === "true" ? MUMBAI_FAUCET_ADMIN : 10,
      mumbai: MUMBAI_FAUCET_ADMIN,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      kovan: process.env.ETHERSCAN_API_KEY,
      rinkeby: process.env.ETHERSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY,
    }
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
  },
};
