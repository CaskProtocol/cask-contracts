// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/ICaskDCA.sol";
import "../interfaces/INFTRenderer.sol";
import "../utils/DescriptorUtils.sol";
import "../utils/base64.sol";

contract DCANFTRenderer is INFTRenderer {

    function tokenURI(address _caskDCA, uint256 _tokenId) external override view returns (string memory) {
        ICaskDCA.DCA memory dca = ICaskDCA(_caskDCA).getDCA(bytes32(_tokenId));
        require(dca.user != address(0), "!INVALID_TOKEN");

        string memory _name = _generateName(_tokenId, dca);
        string memory _description = _generateDescription(_tokenId, dca);
        string memory _image = Base64.encode(bytes(_generateSVG(_tokenId, dca)));
        string memory _attributes = _generateAttributes(_tokenId, dca);
        return
        string(
            abi.encodePacked(
                'data:application/json;base64,',
                Base64.encode(
                    bytes(
                        abi.encodePacked('{"name":"', _name, '", "description":"', _description, '", "attributes": ', _attributes, ', "image": "data:image/svg+xml;base64,', _image, '"}')
                    )
                )
            )
        );
    }

    function _generateDescription(uint256 _tokenId, ICaskDCA.DCA memory _dca) private view returns (string memory) {
        string memory _part1 = string(
            abi.encodePacked(
                'This NFT represents a DCA position in Cask Protocol, where ',
                IERC20Metadata(_dca.path[0]).symbol(),
                ' will be swapped for ',
                IERC20Metadata(_dca.path[_dca.path.length - 1]).symbol(),
                '.\\n\\n',
                IERC20Metadata(_dca.path[0]).symbol()
            )
        );
        string memory _part2 = string(
            abi.encodePacked(
                ' Address: ',
                Strings.toHexString(uint160(_dca.path[0]), 20),
                '\\n',
                IERC20Metadata(_dca.path[_dca.path.length - 1]).symbol(),
                ' Address: ',
                Strings.toHexString(uint160(_dca.path[_dca.path.length - 1]), 20),
                '\\nSwap interval: ',
                _swapPeriodHuman(_dca.period),
                '\\nToken ID: ',
                Strings.toHexString(_tokenId, 32),
                '\\n'
            )
        );
        return string(abi.encodePacked(_part1, _part2));
    }

    function _generateName(uint256 _tokenId, ICaskDCA.DCA memory _dca) private view returns (string memory) {
        return string(abi.encodePacked('Cask Protocol DCA - ', _swapPeriodHuman(_dca.period), ' - ',
            IERC20Metadata(_dca.path[0]).symbol(),
            ' to ',
            IERC20Metadata(_dca.path[_dca.path.length - 1]).symbol()));
    }

    function _generateStatus(uint256 _tokenId, ICaskDCA.DCA memory _dca) private pure returns (string memory) {
        if (_dca.status == ICaskDCA.DCAStatus.Active) return 'Active';
        if (_dca.status == ICaskDCA.DCAStatus.Paused) return 'Paused';
        if (_dca.status == ICaskDCA.DCAStatus.Canceled) return 'Canceled';
        if (_dca.status == ICaskDCA.DCAStatus.Complete) return 'Complete';
        return 'Unknown';
    }

    function _generateAttributes(uint256 _tokenId, ICaskDCA.DCA memory _dca) private view returns (string memory) {
        uint8 fromDecimals = IERC20Metadata(_dca.path[0]).decimals();
        string memory fromSymbol = IERC20Metadata(_dca.path[0]).symbol();
        uint8 toDecimals = IERC20Metadata(_dca.path[_dca.path.length - 1]).decimals();
        string memory toSymbol = IERC20Metadata(_dca.path[_dca.path.length - 1]).symbol();

        string memory _part1 = string(abi.encodePacked(
                '[{"trait_type": "Status", "value": "',_generateStatus(_tokenId, _dca),'"},',
                '{"trait_type": "Period", "value": "',_swapPeriodHuman(_dca.period),'"},',
                '{"trait_type": "Current Amount", "display_type": "number", "value": ',_amountToReadableNoSym(_dca.currentAmount, fromDecimals),'},',
                '{"trait_type": "Total Amount", "display_type": "number", "value": ',_dca.totalAmount > 0 ? _amountToReadableNoSym(_dca.totalAmount, fromDecimals) : '0' ,'},'
        ));

        string memory _part2 = string(abi.encodePacked(
                '{"trait_type": "Acquired", "display_type": "number", "value": ',_amountToReadableNoSym(_dca.currentQty, toDecimals),'},',
                '{"trait_type": "Swaps", "display_type": "number", "value": ',Strings.toString(_dca.numBuys),'},',
                '{"trait_type": "From Token Symbol", "value": "',fromSymbol,'"},',
                '{"trait_type": "From Token Address", "value": "',Strings.toHexString(uint160(_dca.path[0]), 20),'"},'
            ));

        string memory _part3 = string(abi.encodePacked(
                '{"trait_type": "Amount", "display_type": "number", "value": ',_amountToReadableNoSym(_dca.amount, fromDecimals),'},',
                '{"trait_type": "To Token Symbol", "value": "',toSymbol,'"},',
                '{"trait_type": "To Token Address", "value": "',Strings.toHexString(uint160(_dca.path[_dca.path.length - 1]), 20),'"}]'
            ));

        return string(abi.encodePacked(_part1, _part2, _part3));
    }

    function _generateSVG(uint256 _tokenId, ICaskDCA.DCA memory _dca) internal view returns (string memory) {
        return
        string(
            abi.encodePacked(
                '<svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 290 500.62">',
                _generateSVGDefs(_tokenId, _dca),
                _generateSVGBackground(_tokenId, _dca),
                _generateSVGTextAnimation(_tokenId, _dca),
                _generateSVGHeader(_tokenId, _dca),
                _generateSVGTokens(_tokenId, _dca),
                _generateSVGStatus(_tokenId, _dca),
                '<rect x="27" y="200.76" width="233.13" height=".75" style="fill:#fff;"/>',
                _generateSVGData1(_tokenId, _dca),
                _generateSVGData2(_tokenId, _dca),
                '<rect x="27" y="415.45" width="233.13" height=".75" style="fill:#fff;"/>',
                _generateSVGLogo(_tokenId, _dca),
                '</svg>'
            )
        );
    }

    function _generateSVGDefs(uint256 _tokenId, ICaskDCA.DCA memory _dca) internal pure returns (string memory) {
        return
        string(
            abi.encodePacked('<defs><linearGradient id="linear-gradient" x1="145" y1="503.36" x2="145" y2="2.74" gradientTransform="translate(0 503.36) scale(1 -1)" gradientUnits="userSpaceOnUse"><stop offset=".17" stop-color="#271b3f"/><stop offset=".25" stop-color="#271b3f"/><stop offset=".31" stop-color="#271b3f"/><stop offset=".58" stop-color="#644499"/><stop offset=".73" stop-color="#8258c4"/><stop offset=".76" stop-color="#8258c4"/><stop offset=".82" stop-color="#654499"/><stop offset=".89" stop-color="#432e68"/><stop offset=".94" stop-color="#2e204a"/><stop offset=".97" stop-color="#271b3f"/></linearGradient></defs>')
        );
    }

    function _generateSVGBackground(uint256 _tokenId, ICaskDCA.DCA memory _dca) internal pure returns (string memory) {
        return
        string(
            abi.encodePacked('<path d="m290,466.37c0,18.84-17.2,34.25-38.22,34.25H38.22c-21.02,0-38.22-15.41-38.22-34.25V34.25C0,15.41,17.2,0,38.22,0h213.55c21.02,0,38.22,15.41,38.22,34.25v432.11h0Z" style="fill:url(#linear-gradient);"/><path id="frame-path" d="m255.27,484.32H33.85c-10.42,0-18.9-8.4-18.9-18.73V33.69c0-10.33,8.48-18.73,18.9-18.73h221.42c10.42,0,18.9,8.4,18.9,18.73v431.9c0,10.33-8.48,18.73-18.9,18.73ZM33.85,15.7c-10.01,0-18.15,8.07-18.15,17.98v431.9c0,9.92,8.14,17.98,18.15,17.98h221.42c10.01,0,18.15-8.07,18.15-17.98V33.69c0-9.92-8.14-17.98-18.15-17.98H33.85Z" style="fill:#fff;"/>')
        );
    }

    function _generateSVGTextAnimation(uint256 _tokenId, ICaskDCA.DCA memory _dca) internal view returns (string memory) {
        string memory fromSymbol = IERC20Metadata(_dca.path[0]).symbol();
        string memory toSymbol = IERC20Metadata(_dca.path[_dca.path.length - 1]).symbol();

        return
        string(
            abi.encodePacked(
                '<text text-rendering="optimizeSpeed" style="fill:#fff; font-family:Verdana; font-size:8.8px; font-weight:200;"><textPath startOffset="8%" xlink:href="#frame-path" class="st46 st38 st47">From ',
                fromSymbol,' - ',Strings.toHexString(uint160(_dca.path[0]), 20),
                '<animate additive="sum" attributeName="startOffset" from="0%" to="5%" dur="30s" repeatCount="indefinite" /></textPath></text><text text-rendering="optimizeSpeed" style="fill:#fff; font-family:Verdana; font-size:8.8px; font-weight:200;"><textPath startOffset="33%" xlink:href="#frame-path" class="st46 st38 st47">To ',
                toSymbol,' - ', Strings.toHexString(uint160(_dca.path[_dca.path.length - 1]), 20),
                '<animate additive="sum" attributeName="startOffset" from="0%" to="5%" dur="30s" repeatCount="indefinite" /></textPath></text>'
            ));
    }

    function _generateSVGHeader(uint256 _tokenId, ICaskDCA.DCA memory _dca) internal view returns (string memory) {
        return
        string(
            abi.encodePacked(
                '<rect x="95.16" width="104.21" height="34.35" style="fill:#271b3f;"/><text transform="translate(145 21.42) scale(.93 1)" style="fill:#fff; font-family:Verdana-Bold, Verdana; font-size:15.8px; font-weight:700;"><tspan x="0" y="0" text-anchor="middle">DCA</tspan></text>'
            ));
    }

    function _generateSVGTokens(uint256 _tokenId, ICaskDCA.DCA memory _dca) internal view returns (string memory) {
        uint8 fromDecimals = IERC20Metadata(_dca.path[0]).decimals();
        string memory fromSymbol = IERC20Metadata(_dca.path[0]).symbol();
        return
        string(
            abi.encodePacked(
                '<text transform="translate(145 80.6)" style="fill:#fff; font-family:Verdana-Bold, Verdana; font-size:29.47px; font-weight:700; isolation:isolate;"><tspan x="0" y="0" text-anchor="middle">',
                IERC20Metadata(_dca.path[0]).symbol(),
                '</tspan></text><path d="m151.07,99.34c-.64-.64-1.65-.66-2.26-.06l-3.75,3.75v-9.85c0-.74-.74-1.34-1.64-1.34-.9,0-1.64.61-1.64,1.34v9.85s-3.62-3.62-3.62-3.62c-.59-.6-1.6-.56-2.24.08-.64.64-.67,1.64-.08,2.24l5.41,5.41.36.36,1.8,1.8,2.31-2.31h0l5.39-5.39c.61-.61.58-1.62-.06-2.26Z" style="fill:#fff;"/><text transform="translate(145 141.37)" style="fill:#fff; font-family:Verdana-Bold, Verdana; font-size:29.47px; font-weight:700;"><tspan x="0" y="0" text-anchor="middle">',
                IERC20Metadata(_dca.path[_dca.path.length - 1]).symbol(),
                '</tspan></text><text transform="translate(145 230.1) scale(.93 1)" style="fill:#fff; font-family:Verdana-Bold, Verdana; font-size:18.26px; font-weight:700;"><tspan x="0" y="0" text-anchor="middle">',
                _amountToReadable(_dca.amount, fromDecimals, fromSymbol),
                '</tspan></text><text transform="translate(145 252.1) scale(.93 1)" style="fill:#fff; font-family:Verdana-Bold, Verdana; font-size:16.26px; font-weight:700;"><tspan x="0" y="0" text-anchor="middle">',
                _swapPeriodHuman(_dca.period),
                '</tspan></text>'
            ));
    }

    function _generateSVGStatus(uint256 _tokenId, ICaskDCA.DCA memory _dca) internal view returns (string memory) {
        if (_dca.status == ICaskDCA.DCAStatus.Active) {
            return
            string(
                abi.encodePacked('<path style="fill:#34B206" d="M175.1,182.2h-64c-4.9,0-9-4-9-9v0c0-4.9,4-9,9-9h64c4.9,0,9,4,9,9v0C184.1,178.1,180,182.2,175.1,182.2z"/><g><text transform="matrix(1 0 0 1 124.2528 177.4143)" style="fill:#fff; font-family:Verdana-Bold, Verdana; font-size:12px; font-weight:700;">Active</text></g>'));
        } else if (_dca.status == ICaskDCA.DCAStatus.Paused) {
            return
            string(
                abi.encodePacked('<path style="fill:#d69e2f" d="M175.1,182.2h-64c-4.9,0-9-4-9-9v0c0-4.9,4-9,9-9h64c4.9,0,9,4,9,9v0C184.1,178.1,180,182.2,175.1,182.2z"/><g><text transform="matrix(1 0 0 1 124.2528 177.4143)" style="fill:#fff; font-family:Verdana-Bold, Verdana; font-size:12px; font-weight:700;">Paused</text></g>'));
        } else {
            return '';
        }
    }

    function _generateSVGData1(uint256 _tokenId, ICaskDCA.DCA memory _dca) internal view returns (string memory) {
        uint8 fromDecimals = IERC20Metadata(_dca.path[0]).decimals();
        string memory fromSymbol = IERC20Metadata(_dca.path[0]).symbol();
        uint8 toDecimals = IERC20Metadata(_dca.path[_dca.path.length - 1]).decimals();
        string memory toSymbol = IERC20Metadata(_dca.path[_dca.path.length - 1]).symbol();

        return
        string(
            abi.encodePacked(
                '<g style="isolation:isolate;"><text transform="translate(42.49 274.87)" style="fill:#fff; font-family:Verdana, Verdana; font-size:10px; isolation:isolate;"><tspan x="0" y="0">Total Swaps</tspan></text><text transform="translate(42.58 291.64)" style="fill:#fff; font-family:Verdana-Bold, Verdana; font-size:11px; font-weight:700;"><tspan x="0" y="1">',
                Strings.toString(_dca.numBuys),
                '</tspan></text></g><g style="isolation:isolate;"><text transform="translate(177.64 274.87)" style="fill:#fff; font-family:Verdana, Verdana; font-size:10px; isolation:isolate;"><tspan x="0" y="0">Acquired</tspan></text><text transform="translate(176.45 291.64)" style="fill:#fff; font-family:Verdana-Bold, Verdana; font-size:11px; font-weight:700;"><tspan x="0" y="1">',
                _amountToReadable(_dca.currentQty, toDecimals, toSymbol),
                '</tspan></text></g><g style="isolation:isolate;"><text transform="translate(41.05 326.16)" style="fill:#fff; font-family:Verdana, Verdana; font-size:10px; isolation:isolate;"><tspan x="0" y="0">Average Price</tspan></text><text transform="translate(39.19 342.53)" style="fill:#fff; font-family:Verdana-Bold, Verdana; font-size:11px; font-weight:700;"><tspan x="0" y="1">',
                _amountToReadable((_dca.currentAmount - _dca.currentFees) * uint256(10 ** toDecimals) / _dca.currentQty, fromDecimals, fromSymbol),
                '</tspan></text></g>'
            ));
    }

    function _generateSVGData2(uint256 _tokenId, ICaskDCA.DCA memory _dca) internal view returns (string memory) {
        uint8 fromDecimals = IERC20Metadata(_dca.path[0]).decimals();
        string memory fromSymbol = IERC20Metadata(_dca.path[0]).symbol();
        uint8 toDecimals = IERC20Metadata(_dca.path[_dca.path.length - 1]).decimals();
        string memory toSymbol = IERC20Metadata(_dca.path[_dca.path.length - 1]).symbol();

        return
        string(
            abi.encodePacked(
                '<g style="isolation:isolate;"><text transform="translate(175.19 326.16)" style="fill:#fff; font-family:Verdana, Verdana; font-size:10px; isolation:isolate;"><tspan x="0" y="0">Remaining</tspan></text><text transform="translate(176.06 342.53)" style="fill:#fff; font-family:Verdana-Bold, Verdana; font-size:11px; font-weight:700;"><tspan x="0" y="1">',
                _dca.totalAmount > 0 ? _amountToReadable(_dca.totalAmount - _dca.currentAmount, fromDecimals, fromSymbol) : 'N/A',
                '</tspan></text></g><g style="isolation:isolate;"><text transform="translate(39.45 374.3)" style="fill:#fff; font-family:Verdana, Verdana; font-size:10px; isolation:isolate;"><tspan x="0" y="0">Min Price</tspan></text><text transform="translate(39.59 390.67)" style="fill:#fff; font-family:Verdana-Bold, Verdana; font-size:11px; font-weight:700;"><tspan x="0" y="1">',
                _dca.minPrice > 0 ? _amountToReadable(_dca.minPrice, toDecimals, toSymbol) : 'N/A',
                '</tspan></text></g><g style="isolation:isolate;"><text transform="translate(175.19 374.3)" style="fill:#fff; font-family:Verdana, Verdana; font-size:10px; isolation:isolate;"><tspan x="0" y="0">Max Price</tspan></text><text transform="translate(176.06 390.67)" style="fill:#fff; font-family:Verdana-Bold, Verdana; font-size:11px; font-weight:700;"><tspan x="0" y="1">',
                _dca.maxPrice > 0 ? _amountToReadable(_dca.maxPrice, toDecimals, toSymbol) : 'N/A',
                '</tspan></text></g>'
            ));
    }

    function _generateSVGLogo(uint256 _tokenId, ICaskDCA.DCA memory _dca) internal view returns (string memory) {
        return
        string(
            abi.encodePacked(
                '<g><g><path d="m136.35,458.44c-2.61,0-4.75-.89-6.54-2.61-1.72-1.72-2.61-3.92-2.61-6.48s.89-4.75,2.61-6.48,3.92-2.61,6.54-2.61c1.66,0,3.21.42,4.58,1.19,1.37.83,2.44,1.9,3.09,3.27l-3.21,1.84c-.42-.83-1.01-1.49-1.78-1.96s-1.72-.71-2.73-.71c-1.55,0-2.79.53-3.8,1.55-1.01,1.01-1.55,2.32-1.55,3.86s.53,2.85,1.55,3.86,2.32,1.55,3.8,1.55c1.01,0,1.9-.24,2.73-.71s1.43-1.13,1.84-1.96l3.21,1.84c-.71,1.37-1.78,2.5-3.15,3.27-1.37.89-2.91,1.31-4.58,1.31Z" style="fill:#fff;"/><path d="m159.29,440.73h3.74v17.29h-3.74v-2.5c-1.43,1.96-3.45,2.91-6.06,2.91-2.38,0-4.4-.89-6.06-2.61-1.66-1.78-2.5-3.92-2.5-6.42s.83-4.69,2.5-6.48c1.66-1.72,3.68-2.61,6.06-2.61,2.61,0,4.64.95,6.06,2.91v-2.5Zm-9.39,12.6c1.01,1.07,2.32,1.55,3.92,1.55s2.85-.53,3.92-1.55c1.01-1.07,1.55-2.38,1.55-3.98s-.53-2.91-1.55-3.98-2.32-1.55-3.92-1.55-2.85.53-3.92,1.55c-1.01,1.07-1.55,2.38-1.55,3.98s.53,2.91,1.55,3.98Z" style="fill:#fff;"/><path d="m169.69,445.48c0,.59.3,1.01.95,1.37s1.43.59,2.32.89c.89.24,1.84.53,2.73.83s1.72.89,2.32,1.66c.65.77.95,1.72.95,2.91,0,1.66-.65,2.97-1.9,3.92-1.31.95-2.91,1.43-4.81,1.43-1.72,0-3.15-.36-4.4-1.07-1.25-.71-2.08-1.72-2.67-2.97l3.21-1.84c.59,1.66,1.9,2.5,3.86,2.5s2.91-.65,2.91-1.96c0-.53-.3-1.01-.95-1.37s-1.43-.65-2.32-.89-1.84-.53-2.73-.83c-.95-.3-1.72-.83-2.32-1.6-.65-.77-.95-1.72-.95-2.85,0-1.6.59-2.85,1.84-3.86,1.19-.95,2.73-1.43,4.52-1.43,1.43,0,2.67.3,3.8.95s1.96,1.49,2.56,2.61l-3.15,1.78c-.59-1.31-1.66-1.96-3.27-1.96-.71,0-1.31.18-1.78.48-.48.24-.71.71-.71,1.31Z" style="fill:#fff;"/><path d="m196.38,457.96h-4.46l-7.07-7.96v7.96h-3.74v-24.13h3.74v14.56l6.72-7.61h4.58l-7.61,8.44,7.84,8.74Z" style="fill:#fff;"/></g>',
                '<g><path d="m97.49,433.42c1.66.36,3.39.53,5.05.71,2.5.18,5.05.18,7.55.06,2.02-.12,4.1-.3,6.12-.77.89,1.07,1.55,2.32,2.14,3.57-.71.24-1.43.48-2.14.59-2.08.42-4.16.59-6.24.71-1.43.06-2.85.12-4.28.06-1.96-.06-3.86-.18-5.82-.42-1.49-.18-3.03-.48-4.46-.95.48-1.25,1.19-2.44,2.08-3.57h0Z" style="fill:#fff;"/><path d="m94.57,439.06c.48.06.89.3,1.37.36,2.08.48,4.28.71,6.48.83,3.63.24,7.31.18,10.99-.18,1.9-.18,3.86-.48,5.71-1.07.42,1.31.71,2.61.89,3.98-4.93,1.31-10.16,1.55-15.21,1.43-3.8-.12-7.49-.48-11.17-1.49.12-.95.3-1.84.53-2.73.12-.3.24-.71.42-1.13h0Z" style="fill:#fff;"/><path d="m109.49,450.77c3.57.12,7.07.53,10.52,1.43-.18,1.37-.48,2.67-.89,3.98-1.01-.3-1.96-.53-3.03-.71-2.5-.42-4.99-.53-7.49-.65-2.85-.06-5.65,0-8.5.3-1.9.18-3.74.48-5.53,1.07-.42-1.31-.71-2.61-.89-3.98,2.73-.71,5.59-1.13,8.38-1.31,2.44-.18,4.93-.18,7.43-.12h0Z" style="fill:#fff;"/><path d="m112.05,457.13c2.08.18,4.28.48,6.3,1.19-.59,1.31-1.25,2.5-2.14,3.57-2.56-.65-5.29-.77-7.9-.83-3.57-.06-7.31,0-10.76.83-.89-1.07-1.55-2.32-2.14-3.57,2.14-.77,4.52-1.01,6.78-1.19,3.27-.3,6.54-.3,9.87,0h0Z" style="fill:#fff;"/></g></g>'
            ));
    }

    function _amountToReadable(
        uint256 _amount,
        uint8 _decimals,
        string memory _symbol
    ) private pure returns (string memory) {
        return string(abi.encodePacked(DescriptorUtils.fixedPointToDecimalString(_amount, _decimals), ' ', _symbol));
    }

    function _amountToReadableNoSym(
        uint256 _amount,
        uint8 _decimals
    ) private pure returns (string memory) {
        return string(abi.encodePacked(DescriptorUtils.fixedPointToDecimalString(_amount, _decimals)));
    }

    function _swapPeriodHuman(uint256 _period) internal pure returns (string memory) {
        if (_period == 1 hours) return 'Hourly';
        if (_period == 1 days) return 'Daily';
        if (_period == 1 weeks) return 'Weekly';
        if (_period == 1 days * (365/12)) return 'Monthly';
        if (_period == 1 days * (365.25/12)) return 'Monthly';
        if (_period == 1 days * (365/3)) return 'Quarterly';
        if (_period == 1 days * (365.25/3)) return 'Quarterly';
        if (_period == 365 days) return 'Annually';
        if (_period == 365.25 days) return 'Annually';
        return 'Periodically';
    }

}
