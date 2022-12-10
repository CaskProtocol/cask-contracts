const {
    isProtocolChain,
    isDevnet,
} = require("../test/_networks");

const main = async (hre) => {};

main.id = "999_upgrade";
main.tags = ["upgrade"];
main.dependencies = ["upgrade_vault","upgrade_subscriptions","upgrade_dca","upgrade_p2p","upgrade_chainlink_topup"];
main.skip = () => !isProtocolChain || isDevnet;

module.exports = main;