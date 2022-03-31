// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

interface IOperContract {
    function operator() external view returns (address);

    function owner() external view returns (address);
}
