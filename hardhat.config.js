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


// dao networks

const MAINNET_DEPLOYER = "0x00";
const MAINNET_GOVERNOR = "0x00";

const KOVAN_DEPLOYER = "0xA84650DDE43d8b7E674e06BBFF55F4A030D5890C";
const KOVAN_GOVERNOR = "0x939Bb832cF8cfD720C746fE25f3d6632fB1442c3";


// protocol networks

const POLYGON_DEPLOYER = "0x00";
const POLYGON_GOVERNOR = "0x00";
const POLYGON_STRATEGIST = "0x00";

const MUMBAI_DEPLOYER = "0xA84650DDE43d8b7E674e06BBFF55F4A030D5890C";
const MUMBAI_GOVERNOR = "0xcB93EFABe8f77C714afD0a5B867dCE1Df3f9073D"; // switch to multisig
const MUMBAI_STRATEGIST = "0x8009C043330Baf8804A04b804e381929287CAF02";
const MUMBAI_FAUCET_ADMIN = "0x66c56c215b08E95c26D30F859c6AD1C37324Ae98";



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


module.exports = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true
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
      gas: 2100000, gasPrice: 8000000000
    },
    mainnet: {
      url: `${process.env.MAINNET_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.MAINNET_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
    },
    polygon: {
      url: `${process.env.POLYGON_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.POLYGON_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
    },
    mumbai: {
      url: `${process.env.MUMBAI_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.MUMBAI_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
    },
  },
  namedAccounts: {
    deployerAddr: {
      default: 0,
      localhost: 0,
      mainnet: MAINNET_DEPLOYER,
      kovan: KOVAN_DEPLOYER,
      polygon: POLYGON_DEPLOYER,
      mumbai: MUMBAI_DEPLOYER,
    },
    governorAddr: {
      default: 1,
      localhost: process.env.FORK === "true" ? POLYGON_GOVERNOR : 1,
      hardhat: process.env.FORK === "true" ? POLYGON_GOVERNOR : 1,
      mainnet: MAINNET_GOVERNOR,
      kovan: KOVAN_GOVERNOR,
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
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
  },
};
