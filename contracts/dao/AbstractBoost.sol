pragma solidity 0.8.10;


import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import './TokenReward.sol';
import '../Uniswap/TransferHelper.sol';
import "../interface/IVeToken.sol";

abstract contract AbstractBoost is TokenReward {
    using SafeMath for uint256;

    event Attach(address indexed owner, address indexed gauge, uint tokenId);
    event Detach(address indexed owner, address indexed gauge, uint tokenId);
    event Voted(address indexed voter, uint tokenId, int256 weight);
    event Abstained(uint tokenId, int256 weight);

    uint public totalWeight; // total voting weight

    address public immutable veToken; // the ve token that governs these contracts
    address internal immutable base;

    mapping(address => int256) public weights; // pool => weight
    mapping(uint => mapping(address => int256)) public votes; // nft => pool => votes
    mapping(uint => address[]) public poolVote; // nft => pools
    mapping(uint => uint) public usedWeights;  // nft => total voting weight of user


    constructor(address _operatorMsg, address __ve,
        IToken _swapToken,
        uint256 _tokenPerBlock,
        uint256 _startBlock,
        uint256 _period)TokenReward(_operatorMsg, _swapToken, _tokenPerBlock, _startBlock, _period) {
        veToken = __ve;
        base = IVeToken(__ve).token();

    }

    function _reset(uint _tokenId) internal {
        address[] storage _poolVote = poolVote[_tokenId];
        uint _poolVoteCnt = _poolVote.length;
        int256 _totalWeight = 0;

        for (uint i = 0; i < _poolVoteCnt; i ++) {
            address _pool = _poolVote[i];
            int256 _votes = votes[_tokenId][_pool];

            if (_votes != 0) {
                _updatePoolInfo(_pool);
                weights[_pool] -= _votes;
                votes[_tokenId][_pool] -= _votes;
                if (_votes > 0) {
                    _totalWeight += _votes;
                } else {
                    _totalWeight -= _votes;
                }
                emit Abstained(_tokenId, _votes);
            }
        }
        totalWeight -= uint256(_totalWeight);
        usedWeights[_tokenId] = 0;
        delete poolVote[_tokenId];
    }


    function _updatePoolInfo(address _pool) internal virtual;
}
