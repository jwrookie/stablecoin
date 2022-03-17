// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface ICauldron {
    function userCollateralShare(address account) external view returns (uint);
}