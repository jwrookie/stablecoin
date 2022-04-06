// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "./TokenReward.sol";


contract RewardPool is TokenReward {
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;
    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. swapToken to distribute per block.
        uint256 lastRewardBlock;  // Last block number that swap token distribution occurs.
        uint256 accTokenPerShare; // Accumulated swap token per share, times 1e12.
        uint256 totalAmount;    // Total amount of current pool deposit.
    }
    // Info of each pool.
    PoolInfo[] public poolInfo;
    // pid corresponding address
    mapping(address => uint256) public LpOfPid;
    // Control mining
    bool public paused = false;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;


    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        address _operatorMsg,
        IToken _swapToken,
        uint256 _tokenPerBlock,
        uint256 _startBlock,
        uint256 _period
    ) public TokenReward(_operatorMsg, _swapToken, _tokenPerBlock, _startBlock, _period) {
    }

    modifier notPause() {
        require(paused == false, "Mining has been suspended");
        _;
    }

    function poolLength() public view returns (uint256) {
        return poolInfo.length;
    }

    function setPause() public onlyOperator {
        paused = !paused;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate) public onlyOperator {
        require(address(_lpToken) != address(0), "_lpToken is the zero address");
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
        lpToken : _lpToken,
        allocPoint : _allocPoint,
        lastRewardBlock : lastRewardBlock,
        accTokenPerShare : 0,
        totalAmount : 0
        }));
        LpOfPid[address(_lpToken)] = poolLength() - 1;
    }

    // Update the given pool's swapToken allocation point. Can only be called by the owner.
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public onlyOperator {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    // Update reward variables for all pools. Be careful of gas spending!
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
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
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
            pool.accTokenPerShare = pool.accTokenPerShare.add(tokenReward.mul(1e12).div(lpSupply));
        }
        pool.lastRewardBlock = block.number;
    }


}

