pragma solidity 0.8.10;


import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import "@openzeppelin/contracts/access/Ownable.sol";

import "../interface/IDistribute.sol";

import "../tools/CheckPermission.sol";
import "../interface/IVeToken.sol";

abstract contract AbstractController is CheckPermission {

    using SafeMath for uint256;

    event Attach(address indexed owner, address indexed gauge, uint tokenId);
    event Detach(address indexed owner, address indexed gauge, uint tokenId);
    event Voted(address indexed voter, uint tokenId, uint weight);
    event Abstained(uint tokenId, uint weight);


    address public immutable veToken; // the ve token that governs these contracts
    address public immutable base;
    address public immutable distribute;

    uint public duration;
    uint public totalWeight; // total voting weight
    uint public lastUpdate;

    mapping(address => uint) public weights; // pool => weight
    mapping(uint => uint) public usedWeights;  // nft => total voting weight of user
    mapping(uint => address) public userPool;  // nft => pool voting weight of user

    address [] public poolInfo;

    constructor(
        address _operatorMsg, address _boost, address __ve, uint _duration
    )CheckPermission(_operatorMsg) {
        veToken = __ve;
        base = IVeToken(__ve).token();
        distribute = _boost;
        duration = _duration;
    }

    function setDuration(uint _duration) external onlyOperator {
        duration = _duration;
    }

    function reset(uint _tokenId) external {
        require(IVeToken(veToken).isApprovedOrOwner(msg.sender, _tokenId));
        _reset(_tokenId);
        IVeToken(veToken).abstain(_tokenId);
        updatePool();
    }

    function _reset(uint _tokenId) internal {
        uint _totalWeight = usedWeights[_tokenId];
        address _pool = userPool[_tokenId];
        emit Abstained(_tokenId, _totalWeight);
        totalWeight -= _totalWeight;
        usedWeights[_tokenId] = 0;
        delete userPool[_tokenId];
    }

    function _vote(uint _tokenId, address _poolVote) internal {
        _reset(_tokenId);
        uint _weight = IVeToken(veToken).balanceOfNFT(_tokenId);

        weights[_poolVote] = weights[_poolVote].add(_weight);
        emit Voted(msg.sender, _tokenId, _weight);
        IVeToken(veToken).voting(_tokenId);
        totalWeight += _weight;
        usedWeights[_tokenId] = _weight;
        updatePool();
    }

    function poke(uint _tokenId) external {
        _vote(_tokenId, userPool[_tokenId]);
    }


    function vote(uint tokenId, address _poolVote) external {
        require(IVeToken(veToken).isApprovedOrOwner(msg.sender, tokenId));
        _vote(tokenId, _poolVote);
    }

    function updatePool() public {
        if (block.timestamp < lastUpdate.add(duration)) {
            return;
        }

        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            uint256 _id = IDistribute(distribute).lpOfPid(poolInfo[pid]);
            IDistribute(distribute).set(_id, weights[poolInfo[pid]], false);
        }
        IDistribute(distribute).massUpdatePools();
        lastUpdate = block.timestamp;

    }

}
