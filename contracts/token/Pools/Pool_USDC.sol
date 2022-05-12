// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

import "./StablecoinPool.sol";

contract Pool_USDC is StablecoinPool {
    address public USDC_address;

    constructor(
        address _operatorMsg,
        address _stableAddress,
        address _stockAddress,
        address _collateralAddress,
        uint256 _poolCeiling
    )
    public
    StablecoinPool(_operatorMsg, _stableAddress, _stockAddress, _collateralAddress, _poolCeiling)
    {
        require(_collateralAddress != address(0), "0 address");
        USDC_address = _collateralAddress;
    }
}
