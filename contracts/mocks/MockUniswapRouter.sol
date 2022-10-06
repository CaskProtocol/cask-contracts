// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract MockUniswapRouter {

    uint256 outputBps;

    function initialize() public {
        outputBps = 10000; // by default output the same as the input
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory) {
        address tok0 = path[0];
        address tok1 = path[1];
        // Give based on outputBps
        uint256 amountOut = _scaleBy(amountIn, IERC20Metadata(tok1).decimals(), IERC20Metadata(tok0).decimals());
        amountOut = amountOut * outputBps / 10000;

        require(amountOut >= amountOutMin, "Slippage error");
        require(deadline > block.timestamp);

        IERC20Metadata(tok0).transferFrom(msg.sender, address(this), amountIn);
        IERC20Metadata(tok1).transfer(to, amountOut);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;

        return amounts;
    }

    function getAmountsOut(
        uint256 amountIn,
        address[] memory path
    ) external view returns (uint256[] memory) {
        address tok0 = path[0];
        address tok1 = path[1];
        // Give based on outputBps
        uint256 amountOut = _scaleBy(amountIn, IERC20Metadata(tok1).decimals(), IERC20Metadata(tok0).decimals());
        amountOut = amountOut * outputBps / 10000;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;

        return amounts;
    }

    function setOutputBps(
        uint256 _outputBps
    ) external {
        outputBps = _outputBps;
    }

    function _scaleBy(
        uint256 x,
        uint256 to,
        uint256 from
    ) internal pure returns (uint256) {
        if (to > from) {
            return x * (10**(to - from));
        } else if (to < from) {
            return x / (10**(from - to));
        } else {
            return x;
        }
    }
}
