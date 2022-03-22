// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IRariToken {
    function balanceOfUnderlying(address account) external view returns (uint);
    function totalSupply() external view returns (uint);
    function getCash() external view returns (uint);
    function totalBorrows() external view returns (uint);
    function totalReserves() external view returns (uint);
    function totalAdminFees() external view returns (uint);
    function totalFuseFees() external view returns (uint);
    function exchangeRateCurrent() external view returns (uint);
}