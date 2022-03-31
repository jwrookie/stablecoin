// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

interface ISwapMining {
    function swap(
        address account,
        address pair,
        address input,
        address output,
        uint256 amountIn,
        uint256 amountOut
    ) external returns (bool);

    function getReward() external;

    function getReward(uint256 pid) external;
}
