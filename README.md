# Basic Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, a sample script that deploys that contract, and an example of a task implementation, which simply lists the available accounts.

Try running some of the following tasks:

```shell
yarn test
yarn hardhat compile
yarn hardhat console
yarn hardhat node
yarn hardhat deploy
yarn hardhat debug
yarn hardhat accounts
```

# Running a local chain for frontend development

## Compile and start the local chain
```shell
yarn local
```

## Fund the fixture addresses with Mock DAI/USDT/USDC
```shell
yarn hardhat fund --network localhost
```

## Import the fixture addresses into you wallet
```shell
yarn hardhat accounts --network localhost
```

Grab the private key (second column) for one/all of the `consumer` and/or `provider` addresses and import them into your wallet.

Example: https://metamask.zendesk.com/hc/en-us/articles/360015489331-How-to-import-an-Account

## Add the local chain to your wallet networks

```
Network Name: Local
RPC Url: http://localhost:8545
Chain Id: 31337
Currency Symbol: ETH
```
https://satochip.medium.com/metamask-how-to-add-custom-network-binance-smart-chain-polygon-avalanche-43c1c25afd88#3c6d


## Output the addresses of the deployed contracts
```shell
yarn hardhat debug --network localhost
```

You'll need to update `cask-frontend/.env` and add in the Cask contract addresses in these variables...
```
REACT_APP_CASK_SUBSCRIPTIONS_ADDRESS=<"CaskSubscriptions" Address>
REACT_APP_CASK_SUBSCRIPTION_PLANS_ADDRESS=<"CaskSubscriptionPlans" Address>
REACT_APP_CASK_VAULT_ADDRESS=<"CaskVault" Address>
```
...then restart the frontend app.

Note: these addresses may change randomly across local chain restarts so you may need to perform this task periodically.
