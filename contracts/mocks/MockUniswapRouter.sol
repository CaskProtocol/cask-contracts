// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
//import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract MockUniswapRouter {

    mapping(address => address) public pairMaps;

    function initialize(
        address[] calldata _0tokens,
        address[] calldata _1tokens
    ) public {
        require(
            _0tokens.length == _1tokens.length,
            "Mock token pairs should be of the same length"
        );
        for (uint256 i = 0; i < _0tokens.length; i++) {
            pairMaps[_0tokens[i]] = _1tokens[i];
        }
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory) {
        address tok0 = path[0];
        address tok1 = pairMaps[tok0];
        // Give 1:1
        uint256 amountOut = scaleBy(amountIn, IERC20Metadata(tok1).decimals(), IERC20Metadata(tok0).decimals());
        require(amountOut >= amountOutMin, "Slippage error");

        IERC20Metadata(tok0).transferFrom(msg.sender, address(this), amountIn);
        IERC20Metadata(tok1).transfer(to, amountOut);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0;
        amounts[1] = amountOut;

        return amounts;
    }


//    function addLiquidity(
//        address tokenA,
//        address tokenB,
//        uint256 amountADesired,
//        uint256 amountBDesired,
//        uint256 amountAMin,
//        uint256 amountBMin,
//        address to,
//        uint256 deadline
//    )
//    external
//    override
//    returns (
//        uint256 amountA,
//        uint256 amountB,
//        uint256 liquidity
//    )
//    {
//        // this is needed to make this contract whole else it'd be just virtual
//    }

    function scaleBy(
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
