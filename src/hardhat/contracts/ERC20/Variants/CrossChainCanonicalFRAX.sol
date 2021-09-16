// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;
import "../CrossChainCanonical.sol";

contract CrossChainCanonicalFRAX is CrossChainCanonical {
    constructor (
        string memory _name,
        string memory _symbol,
        address _creator_address,
        uint256 _initial_mint_amt,
        address _custodian_address,
        address[] memory _old_tokens
    ) 
    CrossChainCanonical(_name, _symbol, _creator_address, _initial_mint_amt, _custodian_address, _old_tokens)
    {}
}