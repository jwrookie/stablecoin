// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.6.11;

// MAY need to be updated
interface IAMOMinter {

    function frax_mint_balances(address) external view returns (int256);

    function collatDollarBalance() external view returns (uint256);

    function collatDollarBalanceStored() external view returns (uint256);

    function burnFraxFromAMO(uint256 frax_amount) external;

    function receiveCollatFromAMO(uint256 usdc_amount) external;
}