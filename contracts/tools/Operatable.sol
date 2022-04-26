// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import '@openzeppelin/contracts/access/Ownable.sol';

// seperate owner and operator, operator is for daily devops, only owner can update operator
contract Operatable is Ownable {

    constructor(){

    }
}
