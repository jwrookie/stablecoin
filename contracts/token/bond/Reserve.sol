// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../../tools/AbstractPausable.sol";


contract Reserve is AbstractPausable {

    constructor(
        address _operatorMsg
    ) AbstractPausable(_operatorMsg) {

    }


    function recoverToken(address token, uint256 amount) external onlyOperator {
        ERC20(token).transfer(msg.sender, amount);
        emit Recovered(token, msg.sender, amount);
    }

    event Recovered(address token, address to, uint256 amount);

}
