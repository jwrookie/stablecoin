// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../interface/IGauge.sol";
import "../interface/IGaugeFactory.sol";
import "./AbstractController.sol";


contract GaugeController is ReentrancyGuard, AbstractController {
    using SafeMath for uint256;

    constructor(address _operatorMsg, address __ve)AbstractController(_operatorMsg, __ve) {

    }

}
