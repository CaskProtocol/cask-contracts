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
const { dcaMerkleRoot, dcaLiquidity, dcaPublishManifests } = require("./tasks/dca");


// production
const DEPLOYER = "0x54812dBaB593674CD4F1216264895be48B55C5e3";
const KEEPER = "0xa942e8a09dF292Ef66F3d02755E5B5AB04b90709";
const DCA_KEEPER = "0x4a83a3Cc100cE3F36d498dE2922cbd0e5200d493";
const P2P_KEEPER = "0x810146EC490051817ae4399F383B9052569B6Ad7"

// production networks - each chain has their own governor/strategist (multisigs)
const ETHEREUM_GOVERNOR = "0xCaf497e32B5446530ea52647ee997602222AD1E4";

const POLYGON_GOVERNOR = "0x0c91Ec7D8D74A7AffFEe0a53d4447C5b8807F305";
const POLYGON_STRATEGIST = "0x0c91Ec7D8D74A7AffFEe0a53d4447C5b8807F305";

const AVALANCHE_GOVERNOR = "0x65cf6394de068ca0301044f3bad050d925bA3Cfa";
const AVALANCHE_STRATEGIST = "0x65cf6394de068ca0301044f3bad050d925bA3Cfa";

const FANTOM_GOVERNOR = "0xd5F44Ebd3a1999AEFF7F9bdE39f37C699B3b304c";
const FANTOM_STRATEGIST = "0xd5F44Ebd3a1999AEFF7F9bdE39f37C699B3b304c";

const CELO_GOVERNOR = "0xB538e8DcD297450BdeF46222f3CeB33bB1e921b3";
const CELO_STRATEGIST = "0xB538e8DcD297450BdeF46222f3CeB33bB1e921b3";

const AURORA_GOVERNOR = "0xFeAc0a0D83577A29D74d6294A2CeD14e84eee0eC";
const AURORA_STRATEGIST = "0xFeAc0a0D83577A29D74d6294A2CeD14e84eee0eC";

const MOONBEAM_GOVERNOR = "0x57D9355C31b2685F6693A88B9b206E2d274C4b03";
const MOONBEAM_STRATEGIST = "0x57D9355C31b2685F6693A88B9b206E2d274C4b03";

const GNOSIS_GOVERNOR = "0xEF9c41A52920343c75c74b2A45b73DB1FB67b2f2";
const GNOSIS_STRATEGIST = "0xEF9c41A52920343c75c74b2A45b73DB1FB67b2f2";

const ARBITRUM_GOVERNOR = "0xdd5873a087e0c15EE0F017FEf3335eb1E59f9fA0";
const ARBITRUM_STRATEGIST = "0xdd5873a087e0c15EE0F017FEf3335eb1E59f9fA0";

const OPTIMISM_GOVERNOR = "0x145bEA5B40c181Ed8BaE1064c4eCE394aCCD5589";
const OPTIMISM_STRATEGIST = "0x145bEA5B40c181Ed8BaE1064c4eCE394aCCD5589";

const BSC_GOVERNOR = "0xCeaB160B6E33a7d546eBF8737C952fFB27FfD0D1";
const BSC_STRATEGIST = "0xCeaB160B6E33a7d546eBF8737C952fFB27FfD0D1";

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


task("debug:subscriptions", "Print info about subscriptions contracts and their configs", async (taskArguments, hre) => {
  return debug(taskArguments, hre, 'subscriptions');
});
task("debug:dca", "Print info about DCA contracts and their configs", async (taskArguments, hre) => {
  return debug(taskArguments, hre, 'dca');
});
task("debug:p2p", "Print info about P2P contracts and their configs", async (taskArguments, hre) => {
  return debug(taskArguments, hre, 'p2p');
});
task("debug:vault", "Print info about vault contracts and their configs", async (taskArguments, hre) => {
  return debug(taskArguments, hre, 'vault');
});
task("debug:chainlinkTopup", "Print info about chainlinkTopup contracts and their configs", async (taskArguments, hre) => {
  return debug(taskArguments, hre, 'chainlinkTopup');
});
task("debug", "Print info about all contracts and their configs", async (taskArguments, hre) => {
  return debug(taskArguments, hre, 'all');
});

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
    mainnet_celo: {
      url: `${process.env.CELO_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.CELO_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.CELO_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    mainnet_aurora: {
      url: `${process.env.AURORA_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.AURORA_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.AURORA_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    mainnet_moonbeam: {
      url: `${process.env.MOONBEAM_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.MOONBEAM_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.MOONBEAM_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    mainnet_gnosis: {
      url: `${process.env.GNOSIS_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.GNOSIS_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.GNOSIS_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    mainnet_arbitrum: {
      url: `${process.env.ARBITRUM_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.ARBITRUM_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.ARBITRUM_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    mainnet_optimism: {
      url: `${process.env.OPTIMISM_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.OPTIMISM_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.OPTIMISM_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    mainnet_bsc: {
      url: `${process.env.BSC_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.BSC_DEPLOYER_PK || process.env.DEPLOYER_PK || privateKeys[0],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.BSC_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    testnet_mumbai: {
      url: `${process.env.MUMBAI_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.MUMBAI_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
        process.env.MUMBAI_GOVERNOR_PK || process.env.TESTNET_GOVERNOR_PK || privateKeys[1],
      ],
      timeout: 300000,
      gas: 2100000,
      gasPrice: parseInt(process.env.MUMBAI_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    testnet_fantom: {
      url: `${process.env.FTMTESTNET_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.FTMTESTNET_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
        process.env.FTMTESTNET_GOVERNOR_PK || process.env.TESTNET_GOVERNOR_PK || privateKeys[1],
      ],
      timeout: 300000,
      gas: 2100000,
      gasPrice: parseInt(process.env.FTMTESTNET_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    testnet_fuji: {
      url: `${process.env.FUJI_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.FUJI_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
        process.env.FUJI_GOVERNOR_PK || process.env.TESTNET_GOVERNOR_PK || privateKeys[1],
      ],
      timeout: 300000,
      gas: 2100000,
      gasPrice: parseInt(process.env.FUJI_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    testnet_evmos: {
      url: `${process.env.EVMOSTESTNET_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.EVMOSTESTNET_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
        process.env.EVMOSTESTNET_GOVERNOR_PK || process.env.TESTNET_GOVERNOR_PK || privateKeys[1],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.EVMOSTESTNET_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    testnet_alfajores: {
      url: `${process.env.ALFAJORES_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.ALFAJORES_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
        process.env.ALFAJORES_GOVERNOR_PK || process.env.TESTNET_GOVERNOR_PK || privateKeys[1],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.ALFAJORES_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    testnet_aurora: {
      url: `${process.env.AURORATESTNET_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.AURORATESTNET_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
        process.env.AURORATESTNET_GOVERNOR_PK || process.env.TESTNET_GOVERNOR_PK || privateKeys[1],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.AURORA_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    testnet_ogoerli: {
      url: `${process.env.OGOERLI_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.OGOERLI_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
        process.env.OGOERLI_GOVERNOR_PK || process.env.TESTNET_GOVERNOR_PK || privateKeys[1],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.OGOERLI_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    testnet_agoerli: {
      url: `${process.env.AGOERLI_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.AGOERLI_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
        process.env.AGOERLI_GOVERNOR_PK || process.env.TESTNET_GOVERNOR_PK || privateKeys[1],
      ],
      timeout: 300000,
      gasPrice: parseInt(process.env.AGOERLI_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    internal_mumbai: {
      url: `${process.env.MUMBAI_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.INTERNAL_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
        process.env.INTERNAL_GOVERNOR_PK || process.env.TESTNET_GOVERNOR_PK || privateKeys[1],
      ],
      timeout: 300000,
      gas: 2100000,
      gasPrice: parseInt(process.env.MUMBAI_GAS_PRICE || process.env.GAS_PRICE) || 'auto',
    },
    internal_fuji: {
      url: `${process.env.FUJI_PROVIDER_URL || process.env.PROVIDER_URL}`,
      accounts: [
        process.env.INTERNAL_DEPLOYER_PK || process.env.TESTNET_DEPLOYER_PK || privateKeys[0],
        process.env.INTERNAL_GOVERNOR_PK || process.env.TESTNET_GOVERNOR_PK || privateKeys[1],
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
      mainnet_celo: DEPLOYER,
      mainnet_aurora: DEPLOYER,
      mainnet_moonbeam: DEPLOYER,
      mainnet_gnosis: DEPLOYER,
      mainnet_arbitrum: DEPLOYER,
      mainnet_optimism: DEPLOYER,
      mainnet_bsc: DEPLOYER,

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
      testnet_ogoerli: TESTNET_DEPLOYER,
      testnet_agoerli: TESTNET_DEPLOYER,
    },
    governorAddr: {
      ethereum: ETHEREUM_GOVERNOR,
      mainnet_polygon: POLYGON_GOVERNOR,
      mainnet_avalanche: AVALANCHE_GOVERNOR,
      mainnet_fantom: FANTOM_GOVERNOR,
      mainnet_celo: CELO_GOVERNOR,
      mainnet_aurora: AURORA_GOVERNOR,
      mainnet_moonbeam: MOONBEAM_GOVERNOR,
      mainnet_gnosis: GNOSIS_GOVERNOR,
      mainnet_arbitrum: ARBITRUM_GOVERNOR,
      mainnet_optimism: OPTIMISM_GOVERNOR,
      mainnet_bsc: BSC_GOVERNOR,

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
      testnet_ogoerli: TESTNET_GOVERNOR,
      testnet_agoerli: TESTNET_GOVERNOR,
    },
    strategistAddr: {
      mainnet_polygon: POLYGON_STRATEGIST,
      mainnet_avalanche: AVALANCHE_STRATEGIST,
      mainnet_fantom: FANTOM_STRATEGIST,
      mainnet_celo: CELO_STRATEGIST,
      mainnet_aurora: AURORA_STRATEGIST,
      mainnet_moonbeam: MOONBEAM_STRATEGIST,
      mainnet_gnosis: GNOSIS_STRATEGIST,
      mainnet_arbitrum: ARBITRUM_STRATEGIST,
      mainnet_optimism: OPTIMISM_STRATEGIST,
      mainnet_bsc: BSC_STRATEGIST,

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
      testnet_ogoerli: TESTNET_STRATEGIST,
      testnet_agoerli: TESTNET_STRATEGIST,
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
      testnet_ogoerli: TESTNET_FAUCET_ADMIN,
      testnet_agoerli: TESTNET_FAUCET_ADMIN,
    },
    keeperAddr: {
      mainnet_polygon: KEEPER,
      mainnet_avalanche: KEEPER,
      mainnet_fantom: KEEPER,
      mainnet_celo: KEEPER,
      mainnet_aurora: KEEPER,
      mainnet_moonbeam: KEEPER,
      mainnet_gnosis: KEEPER,
      mainnet_arbitrum: KEEPER,
      mainnet_optimism: KEEPER,
      mainnet_bsc: KEEPER,

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
      testnet_ogoerli: TESTNET_KEEPER,
      testnet_agoerli: TESTNET_KEEPER,
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
      aurora: process.env.AURORASCAN_API_KEY,
      celo: process.env.CELOSCAN_API_KEY,
      moonbeam: process.env.MOONSCAN_API_KEY,
      gnosis: process.env.GNOSISSCAN_API_KEY,
      arbitrumOne: process.env.ARBSCAN_API_KEY,
      optimisticEthereum: process.env.OPTIMISTIC_ETHERSCAN_API_KEY,
      bsc: process.env.BSCSCAN_API_KEY,
    },
    customChains: [
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: "https://api.celoscan.xyz/api",
          browserURL: "https://celoscan.xyz"
        }
      },
      {
        network: "gnosis",
        chainId: 100,
        urls: {
          apiURL: "https://api.gnosisscan.io/api",
          browserURL: "https://gnosisscan.io"
        }
      }
    ]
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
  },
};
