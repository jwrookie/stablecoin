// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../interface/IGauge.sol";
import "../interface/IGaugeFactory.sol";

import './AbstractBoost.sol';


contract GaugeController is ReentrancyGuard {
    using SafeMath for uint256;


}
