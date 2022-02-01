const { parseUnits, formatUnits } = require("ethers").utils;

const now = Math.floor(Date.now() / 1000);
const hour = 3600;
const day = 24 * hour;
const month = (365/12) * day;
const year = month * 12;

function caskUnits(amount) {
    return parseUnits(amount, 18);
}

function caskUnitsFormat(amount) {
    return formatUnits(amount, 18);
}

function usdtUnits(amount) {
    return parseUnits(amount, 6);
}

function usdtUnitsFormat(amount) {
    return formatUnits(amount, 6);
}

function usdcUnits(amount) {
    return parseUnits(amount, 6);
}

function usdcUnitsFormat(amount) {
    return formatUnits(amount, 6);
}

function daiUnits(amount) {
    return parseUnits(amount, 18);
}

function daiUnitsFormat(amount) {
    return formatUnits(amount, 18);
}

module.exports = {
    now,
    hour,
    day,
    month,
    year,
    caskUnits,
    usdtUnits,
    usdcUnits,
    daiUnits,
    caskUnitsFormat,
    daiUnitsFormat,
    usdcUnitsFormat,
    usdtUnitsFormat,
};