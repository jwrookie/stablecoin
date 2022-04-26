// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.6.11;

import "./PoolvAMM.sol";

contract PoolvAMM_USDC is PoolvAMM {
    address public USDC_address;
    constructor (
        address _operatorMsg,
        address _frax_contract_address,
        address _fxs_contract_address,
        address _collateral_address,
        address _uniswap_factory_address,
        address _fxs_usdc_oracle_addr,
        uint256 _pool_ceiling
    )
    PoolvAMM(_operatorMsg, _frax_contract_address, _fxs_contract_address, _collateral_address, _uniswap_factory_address, _fxs_usdc_oracle_addr, _pool_ceiling)
    {
        USDC_address = _collateral_address;
    }
}
