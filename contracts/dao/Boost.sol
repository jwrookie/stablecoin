// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../interface/IGauge.sol";
import "../interface/IGaugeFactory.sol";

import './AbstractBoost.sol';


contract Boost is ReentrancyGuard, AbstractBoost {
    using SafeMath for uint256;

    event GaugeCreated(address indexed gauge, address creator, address indexed pool);

    event Deposit(address indexed lp, address indexed gauge, uint tokenId, uint amount);
    event Withdraw(address indexed lp, address indexed gauge, uint tokenId, uint amount);
    event NotifyReward(address indexed sender, address indexed reward, uint amount);
    event DistributeReward(address indexed sender, address indexed gauge, uint amount);

    // Info of each pool.
    struct PoolInfo {
        address lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
    }

    address public immutable gaugeFactory;
    uint256 public totalAllocPoint = 0;
    PoolInfo[] public poolInfo;
    // pid corresponding address
    mapping(address => uint256) public LpOfPid;


    uint public constant duration = 7 days; // rewards are released over 7 days

    address[] public pools; // all pools viable for incentives
    mapping(address => address) public gauges; // pool => gauge
    mapping(address => address) public poolForGauge; // gauge => pool
    mapping(address => bool) public isGauge;

    constructor(address _operatorMsg, address __ve, address _gauges,
        IToken _swapToken,
        uint256 _tokenPerBlock,
        uint256 _startBlock,
        uint256 _period)AbstractBoost(_operatorMsg, __ve, _swapToken, _tokenPerBlock, _startBlock, _period) {

        gaugeFactory = _gauges;

    }

    function poolLength() public view returns (uint256) {
        return poolInfo.length;
    }

    function reset(uint _tokenId) external {
        require(IVeToken(veToken).isApprovedOrOwner(msg.sender, _tokenId));
        _reset(_tokenId);
        IVeToken(veToken).abstain(_tokenId);
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

    function _vote(uint _tokenId, address[] memory _poolVote, int256[] memory _weights) internal {
        _reset(_tokenId);
        uint _poolCnt = _poolVote.length;
        int256 _weight = int256(IVeToken(veToken).balanceOfNFT(_tokenId));
        int256 _totalVoteWeight = 0;
        int256 _totalWeight = 0;
        int256 _usedWeight = 0;

        for (uint i = 0; i < _poolCnt; i++) {
            _totalVoteWeight += _weights[i] > 0 ? _weights[i] : - _weights[i];
        }

        for (uint i = 0; i < _poolCnt; i++) {
            address _pool = _poolVote[i];
            address _gauge = gauges[_pool];

            if (isGauge[_gauge]) {
                int256 _poolWeight = _weights[i] * _weight / _totalVoteWeight;
                require(votes[_tokenId][_pool] == 0);
                require(_poolWeight != 0);
                _updateForGauge(_gauge);

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
        }
        if (_usedWeight > 0) IVeToken(veToken).voting(_tokenId);
        totalWeight += uint256(_totalWeight);
        usedWeights[_tokenId] = uint256(_usedWeight);
    }

    function vote(uint tokenId, address[] calldata _poolVote, int256[] calldata _weights) external {
        require(IVeToken(veToken).isApprovedOrOwner(msg.sender, tokenId));
        require(_poolVote.length == _weights.length);
        _vote(tokenId, _poolVote, _weights);
    }

    function createGauge(address _pool, uint256 _allocPoint, bool _withUpdate) external returns (address) {
        require(gauges[_pool] == address(0x0), "exists");

        require(address(_pool) != address(0), "_lpToken is the zero address");
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
        lpToken : _pool,
        allocPoint : _allocPoint,
        lastRewardBlock : lastRewardBlock
        }));
        LpOfPid[address(_pool)] = poolLength() - 1;

        address _gauge = IGaugeFactory(gaugeFactory).createGauge(_pool, veToken);
        IERC20(base).approve(_gauge, type(uint).max);
        gauges[_pool] = _gauge;
        poolForGauge[_gauge] = _pool;
        isGauge[_gauge] = true;
        _updateForGauge(_gauge);
        emit GaugeCreated(_gauge, msg.sender, _pool);
        return _gauge;
    }

    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public onlyOwner {

        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
        if (_withUpdate) {
            massUpdatePools();
        }
    }

    function massUpdatePools() public override {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public reduceBlockReward {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = IERC20(pool.lpToken).balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        if (tokenPerBlock <= 0) {
            return;
        }
        uint256 mul = block.number.sub(pool.lastRewardBlock);
        uint256 tokenReward = tokenPerBlock.mul(mul).mul(pool.allocPoint).div(totalAllocPoint);
        bool minRet = swapToken.mint(address(this), tokenReward);
        if (minRet) {
            IGauge(gauges[pool.lpToken]).notifyRewardAmount(base, tokenPerBlock.mul(pool.allocPoint).div(totalAllocPoint));
        }
        pool.lastRewardBlock = block.number;
    }


    function attachTokenToGauge(uint tokenId, address account) external {
        require(isGauge[msg.sender]);
        if (tokenId > 0) IVeToken(veToken).attach(tokenId);
        emit Attach(account, msg.sender, tokenId);
    }

    function emitDeposit(uint tokenId, address account, uint amount) external {
        require(isGauge[msg.sender]);
        emit Deposit(account, msg.sender, tokenId, amount);
    }

    function detachTokenFromGauge(uint tokenId, address account) external {
        require(isGauge[msg.sender]);
        if (tokenId > 0) IVeToken(veToken).detach(tokenId);
        emit Detach(account, msg.sender, tokenId);
    }

    function emitWithdraw(uint tokenId, address account, uint amount) external {
        require(isGauge[msg.sender]);
        emit Withdraw(account, msg.sender, tokenId, amount);
    }

    function updateAll() external {
        for (uint i = 0; i < poolLength(); i++) {
            PoolInfo memory pool = poolInfo[i];
            _updateForGauge(gauges[pool.lpToken]);
        }
    }

    function _updateForGauge(address _gauge) internal {
        address _pool = poolForGauge[_gauge];
        updatePool(LpOfPid[_pool]);
    }

    function claimRewards(address[] memory _gauges, address[][] memory _tokens) external {
        for (uint i = 0; i < _gauges.length; i++) {
            IGauge(_gauges[i]).getReward(msg.sender, _tokens[i]);
        }
    }

    function distribute(address _gauge) public nonReentrant {
        _updateForGauge(_gauge);

    }
    function _updatePoolInfo(address _pool) internal override{
        _updateForGauge(gauges[_pool]);
    }
}
