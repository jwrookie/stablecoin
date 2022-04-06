pragma solidity 0.8.10;


import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import './TokenReward.sol';
import '../Uniswap/TransferHelper.sol';
import "../interface/IVeToken.sol";

abstract contract AbstractBoost is TokenReward {
    using SafeMath for uint256;

    address public immutable veToken; // the ve token that governs these contracts
    address internal immutable base;
    constructor(address _operatorMsg, address __ve,
        IToken _swapToken,
        uint256 _tokenPerBlock,
        uint256 _startBlock,
        uint256 _period)TokenReward(_operatorMsg, _swapToken, _tokenPerBlock, _startBlock, _period) {
        veToken = __ve;
        base = IVeToken(__ve).token();

    }
    
}
