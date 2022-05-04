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

    event NotifyReward(address indexed sender, address indexed reward, uint amount);
    event DistributeReward(address indexed sender, address indexed gauge, uint amount);
    event ControllerAdded(address _address);
    event ControllerRemoved(address _address);

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
    mapping(address => uint256) public lpOfPid;


    uint public constant duration = 7 days; // rewards are released over 7 days

    address[] public pools; // all pools viable for incentives
    mapping(address => address) public gauges; // pool => gauge
    mapping(address => address) public poolForGauge; // gauge => pool
    mapping(address => bool) public isGauge;
    mapping(address => bool) public controllers;

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
        lpOfPid[address(_pool)] = poolLength() - 1;

        address _gauge = IGaugeFactory(gaugeFactory).createGauge(_pool, veToken, address(swapToken));
        IERC20(address(swapToken)).approve(_gauge, type(uint).max);
        gauges[_pool] = _gauge;
        poolForGauge[_gauge] = _pool;
        isGauge[_gauge] = true;
        _updateForGauge(_gauge);
        emit GaugeCreated(_gauge, msg.sender, _pool);
        return _gauge;
    }

    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public {
        require(controllers[msg.sender] || msg.sender == operator(), "no auth");

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
        uint256 lpSupply = IERC20(pool.lpToken).balanceOf(gauges[pool.lpToken]);
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        if (tokenPerBlock <= 0) {
            return;
        }
        uint256 mul = block.number.sub(pool.lastRewardBlock);
        uint256 tokenReward = tokenPerBlock.mul(mul).mul(pool.allocPoint).div(totalAllocPoint);
        //todo duration
        bool minRet = swapToken.mint(address(this), tokenReward.mul(duration));
        if (minRet) {
            IGauge(gauges[pool.lpToken]).notifyRewardAmount(address(swapToken), tokenPerBlock.mul(pool.allocPoint).div(totalAllocPoint));
        }
        pool.lastRewardBlock = block.number;
    }


    function updateAll() external {
        for (uint i = 0; i < poolLength(); i++) {
            PoolInfo memory pool = poolInfo[i];
            _updateForGauge(gauges[pool.lpToken]);
        }
    }

    function _updateForGauge(address _gauge) internal {
        address _pool = poolForGauge[_gauge];
        updatePool(lpOfPid[_pool]);
    }

    function claimRewards(address[] memory _gauges, address[][] memory _tokens) external {
        for (uint i = 0; i < _gauges.length; i++) {
            IGauge(_gauges[i]).getReward(msg.sender, _tokens[i]);
        }
    }

    function distribute(address _gauge) public {
        _updateForGauge(_gauge);

    }

    function _updatePoolInfo(address _pool) internal override {
        _updateForGauge(gauges[_pool]);
    }

    function isGaugeForPool(address _pool) internal override view returns (bool){
        return isGauge[gauges[_pool]];
    }

    function addController(address _address) external onlyOperator {
        require(_address != address(0), "0 address");
        require(controllers[_address] == false, "Address already exists");
        controllers[_address] = true;
        emit ControllerAdded(_address);
    }

    function removeController(address _address) external onlyOperator {
        require(controllers[_address] == true, "Address no exist");
        delete controllers[_address];
        emit ControllerRemoved(_address);
    }


}
