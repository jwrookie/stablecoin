// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import './Operatable.sol';
import "../interface/IOperContract.sol";

// seperate owner and operator, operator is for daily devops, only owner can update operator
contract CheckOper is IOperContract {
    Operatable public operatable;

    event SetOperatorContract(address indexed oldOperator, address indexed newOperator);

    constructor(address _oper){
        operatable = Operatable(_oper);
        emit SetOperatorContract(address(0), _oper);
    }

    modifier onlyOperator() {
        require(operatable.operator() == msg.sender, 'not operator');
        _;
    }

    modifier onlyOwner() {
        require(operatable.owner() == msg.sender, 'Ownable: caller is not the owner');
        _;
    }

    function operator() public view override returns (address) {
        return operatable.operator();
    }

    function owner() public view override returns (address) {
        return operatable.owner();
    }

    function setOperContract(address _oper) public onlyOwner {
        require(_oper != address(0), 'bad new operator');
        address oldOperator = _oper;
        operatable = Operatable(_oper);
        emit SetOperatorContract(oldOperator, _oper);
    }
}
