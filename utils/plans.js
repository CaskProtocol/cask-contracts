const ethers = require("ethers");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require('keccak256')

// price should be a BigNumber, such as from `ethers.utils.parseUnits('100', 18)`
function encodePlanData(planId, price, period, freeTrial, maxActive, minPeriods, canPause, canTransfer) {
    const options =
        (canTransfer ? 1 : 0) << 1 |
        (canPause ? 1 : 0);

    return ethers.utils.hexlify([
        ...ethers.utils.zeroPad(price, 12),
        ...ethers.utils.zeroPad(planId, 4),
        ...ethers.utils.zeroPad(period, 4),
        ...ethers.utils.zeroPad(freeTrial, 4),
        ...ethers.utils.zeroPad(maxActive, 4),
        ...ethers.utils.zeroPad(minPeriods, 2),
        ...ethers.utils.zeroPad(options, 2)
    ]);
}

function parsePlanData(planData) {
    const options = parseInt(ethers.utils.hexDataSlice(planData, 31, 32)); // 2 bytes (at the end)

    return {
        price: ethers.BigNumber.from(ethers.utils.hexDataSlice(planData, 0, 12)), // 12 bytes
        planId: parseInt(ethers.utils.hexDataSlice(planData, 13, 16)), // 4 bytes
        period: parseInt(ethers.utils.hexDataSlice(planData, 17, 20)), // 4 bytes
        freeTrial: parseInt(ethers.utils.hexDataSlice(planData, 21, 24)), // 4 bytes
        maxActive: parseInt(ethers.utils.hexDataSlice(planData, 25, 28)), // 4 bytes
        minPeriods: parseInt(ethers.utils.hexDataSlice(planData, 29, 30)), // 2 bytes
        canPause: (options & 0x0001) === 0x0001,
        canTransfer: (options & 0x0002) === 0x0002,
    }
}

// expected plan data merkletree format:
// const plans = [
//     { planData: 10 },
//     { planData: 15 },
//     { planData: 20 },
//     { planData: 30 },
// ];
function _plansMerkleLeafHash(plan) {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
        [ "bytes32"],
        [ plan.planData]
    ));
}

function _plansMerkleTree(plans) {
    const elements = plans.map((plan) => _plansMerkleLeafHash(plan));
    return new MerkleTree(elements, keccak256, { sort: true });
}

function plansMerkleRoot(plans) {
    const merkleTree = _plansMerkleTree(plans);
    return merkleTree.getHexRoot();
}

function plansMerkleProof(plans, plan) {
    const merkleTree = _plansMerkleTree(plans);
    return merkleTree.getHexProof(_plansMerkleLeafHash(plan));
}

function generatePlanProof(provider, ref, planData, merkleRoot, merkleProof) {
    return [
        ethers.utils.hexZeroPad(provider, 32),
        ethers.utils.hexZeroPad(ref, 32),
        planData,
        merkleRoot,
        ...merkleProof
    ];
}


function encodeDiscountData(value, validAfter, expiresAt, maxUses, planId, isFixed) {
    const options =
        (isFixed ? 1 : 0);

    return ethers.utils.hexlify([
        ...ethers.utils.zeroPad(value, 12),
        ...ethers.utils.zeroPad(validAfter, 4),
        ...ethers.utils.zeroPad(expiresAt, 4),
        ...ethers.utils.zeroPad(maxUses, 4),
        ...ethers.utils.zeroPad(planId, 4),
        ...ethers.utils.zeroPad(0, 2), // reserved
        ...ethers.utils.zeroPad(options, 2),
    ]);
}

function parseDiscountData(discountData) {
    const options = parseInt(ethers.utils.hexDataSlice(discountData, 31, 32)); // 2 bytes (at the end)

    return {
        value: ethers.BigNumber.from(ethers.utils.hexDataSlice(discountData, 0, 12)), // 12 bytes
        validAfter: parseInt(ethers.utils.hexDataSlice(discountData, 13, 16)), // 4 bytes
        expiresAt: parseInt(ethers.utils.hexDataSlice(discountData, 17, 20)), // 4 bytes
        maxUses: parseInt(ethers.utils.hexDataSlice(discountData, 21, 24)), // 4 bytes
        planId: parseInt(ethers.utils.hexDataSlice(discountData, 25, 28)), // 4 bytes
        // reserved: parseInt(ethers.utils.hexDataSlice(discountData, 29, 30)), // 2 bytes
        isFixed: (options & 0x0001) === 0x0001,
    }
}

function generateDiscountId(code) {
    return ethers.utils.keccak256(generateDiscountCodeProof(code));
}

function generateDiscountCodeProof(code) {
    return ethers.utils.id(code.toUpperCase());
}

// expected discount data merkletree format:
// const discounts = [
//     { discountId: '0x..', discountData: 10 },
//     { discountId: '0x..', discountData: 50 },
//     { discountId: '0x..', discountData: 24 },
//     { discountId: '0x..', discountData: 95 },
// ];
function _discountsMerkleLeafHash(discount) {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
        [ "bytes32", "bytes32" ],
        [ discount.discountId, discount.discountData ]
    ));
}

function _discountsMerkleTree(discounts) {
    const elements = discounts.map((discount) => _discountsMerkleLeafHash(discount));
    return new MerkleTree(elements, keccak256, { sort: true });
}

function discountsMerkleRoot(discounts) {
    const merkleTree = _discountsMerkleTree(discounts);
    return ethers.utils.hexZeroPad(merkleTree.getHexRoot(), 32);
}

function discountsMerkleProof(discounts, discount) {
    const merkleTree = _discountsMerkleTree(discounts);
    return merkleTree.getHexProof(_discountsMerkleLeafHash(discount));
}

function generateDiscountProof(discountCodeProof, discountData, merkleRoot, merkleProof=[]) {
    return [
        ethers.utils.hexZeroPad(discountCodeProof, 32),
        ethers.utils.hexZeroPad(discountData, 32),
        ethers.utils.hexZeroPad(merkleRoot, 32),
        ...merkleProof
    ];
}

function lookupDiscount(discountCodeProof, discounts) {
    const discountId = ethers.utils.keccak256(discountCodeProof);
    return discounts.find((d) => d.discountId === discountId);
}


async function signMerkleRoots(signer, plansMerkleRoot, discountsMerkleRoot) {
    const payload = ethers.utils.defaultAbiCoder.encode(
        [ "bytes32", "bytes32" ],
        [ plansMerkleRoot, discountsMerkleRoot ]);
    return signer.signMessage(ethers.utils.arrayify(ethers.utils.keccak256(payload)));
}

module.exports = {
    // plans helpers
    encodePlanData,
    parsePlanData,
    plansMerkleRoot,
    plansMerkleProof,
    generatePlanProof,

    // discounts helpers
    encodeDiscountData,
    parseDiscountData,
    generateDiscountId,
    generateDiscountCodeProof,
    discountsMerkleRoot,
    discountsMerkleProof,
    generateDiscountProof,
    lookupDiscount,

    // signature helpers
    signMerkleRoots,
};