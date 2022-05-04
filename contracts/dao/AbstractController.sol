pragma solidity 0.8.10;


import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import "@openzeppelin/contracts/access/Ownable.sol";

import "../interface/IBoost.sol";

import "../tools/CheckPermission.sol";
import "../interface/IVeToken.sol";

abstract contract AbstractController is CheckPermission {
    event Attach(address indexed owner, address indexed gauge, uint tokenId);
    event Detach(address indexed owner, address indexed gauge, uint tokenId);
    event Voted(address indexed voter, uint tokenId, uint weight);
    event Abstained(uint tokenId, uint weight);

    //    uint internal immutable duration;



    uint public totalWeight; // total voting weight

    address public immutable veToken; // the ve token that governs these contracts
    address internal immutable base;
    address internal immutable boost;

    mapping(address => uint) public weights; // pool => weight
    mapping(uint => mapping(address => uint)) public votes; // nft => pool => votes
    mapping(uint => address[]) public poolVote; // nft => pools
    mapping(uint => uint) public usedWeights;  // nft => total voting weight of user

    address [] public poolInfo;

    constructor(address _operatorMsg, address __ve)CheckPermission(_operatorMsg) {
        veToken = __ve;
        base = IVeToken(__ve).token();
    }

    function getPoolVote(uint256 tokenId) public view returns (address[] memory){
        return poolVote[tokenId];
    }

    function reset(uint _tokenId) external {
        require(IVeToken(veToken).isApprovedOrOwner(msg.sender, _tokenId));
        _reset(_tokenId);
        IVeToken(veToken).abstain(_tokenId);
    }

    function _reset(uint _tokenId) internal {
        address[] storage _poolVote = poolVote[_tokenId];
        uint _poolVoteCnt = _poolVote.length;
        uint _totalWeight = 0;
        for (uint i = 0; i < _poolVoteCnt; i ++) {
            address _pool = _poolVote[i];
            uint _votes = votes[_tokenId][_pool];

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

    function _vote(uint _tokenId, address[] memory _poolVote, uint[] memory _weights) internal {
        _reset(_tokenId);
        uint _poolCnt = _poolVote.length;
        uint _weight = IVeToken(veToken).balanceOfNFT(_tokenId);
        uint _totalVoteWeight = 0;
        uint _totalWeight = 0;
        uint _usedWeight = 0;

        for (uint i = 0; i < _poolCnt; i++) {
            _totalVoteWeight += _weights[i] > 0 ? _weights[i] : - _weights[i];
        }

        for (uint i = 0; i < _poolCnt; i++) {
            address _pool = _poolVote[i];


            uint _poolWeight = _weights[i] * _weight / _totalVoteWeight;
            require(votes[_tokenId][_pool] == 0, "token pool is 0");
            require(_poolWeight != 0, "weight is 0");
            _updatePoolInfo(_pool);

            poolVote[_tokenId].push(_pool);

            weights[_pool] += _poolWeight;
            votes[_tokenId][_pool] += _poolWeight;
            if (_poolWeight > 0) {
            } else {
                _poolWeight = - _poolWeight;
            }
            _usedWeight += _poolWeight;
            _totalWeight += _poolWeight;
            emit Voted(msg.sender, _tokenId, _poolWeight);

        }
        if (_usedWeight > 0) IVeToken(veToken).voting(_tokenId);
        totalWeight += uint256(_totalWeight);
        usedWeights[_tokenId] = uint256(_usedWeight);
    }

    function poke(uint _tokenId) external {
        address[] memory _poolVote = poolVote[_tokenId];
        uint _poolCnt = _poolVote.length;
        int256[] memory _weights = new int256[](_poolCnt);

        for (uint i = 0; i < _poolCnt; i ++) {
            _weights[i] = votes[_tokenId][_poolVote[i]];
        }

        _vote(_tokenId, _poolVote, _weights);
    }


    function vote(uint tokenId, address[] calldata _poolVote, int256[] calldata _weights) external {
        require(IVeToken(veToken).isApprovedOrOwner(msg.sender, tokenId));
        require(_poolVote.length == _weights.length);
        _vote(tokenId, _poolVote, _weights);
    }

    function _updatePoolInfo(address _pool) internal {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            uint256 _id = IBoost(boost).lpOfPid(poolInfo[pid]);
            IBoost(boost).set(_id, weights[poolInfo[pid]], false);
        }
        IBoost(boost).massUpdatePools();

    }

}
