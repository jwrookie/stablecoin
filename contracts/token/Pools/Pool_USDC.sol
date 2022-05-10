// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

import "./StablecoinPool.sol";

contract Pool_USDC is StablecoinPool {
    address public USDC_address;

    constructor(
        address _operatorMsg,
        address _frax_contract_address,
        address _fxs_contract_address,
        address _collateral_address,
        uint256 _pool_ceiling
    )
        public
        StablecoinPool(_operatorMsg, _frax_contract_address, _fxs_contract_address, _collateral_address, _pool_ceiling)
    {
        require(_collateral_address != address(0), "0 address");
        USDC_address = _collateral_address;
    }
}
