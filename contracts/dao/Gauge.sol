// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../interface/IVeToken.sol";
import "../interface/IBoost.sol";
import '../tools/TransferHelper.sol';

// Gauges are used to incentivize pools, they emit reward tokens over 7 days for staked LP tokens
contract Gauge is ReentrancyGuard {
    using SafeMath for uint256;

    event Deposit(address indexed from, uint tokenId, uint amount);
    event Withdraw(address indexed from, uint tokenId, uint amount);
    event NotifyReward(address indexed from, address indexed reward, uint rewardRate);
    event ClaimRewards(address indexed from, address indexed reward, uint amount);

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt.

    }

    address public immutable stake; // the LP token that needs to be staked for rewards
    address public immutable veToken; // the ve token used for gauges
    address public immutable boost;
    address public immutable rewardToken;
    uint internal constant PRECISION = 10 ** 18;
    mapping(address => uint) public tokenIds;

    uint256 public tokenPerBlock;
    uint256 public accTokenPerShare; // Accumulated swap token per share, times 1e12.
    uint256 public lastRewardBlock;  // Last block number that swap token distribution occurs

    uint public totalSupply;

    mapping(address => UserInfo) public userInfo;

    constructor(address _stake, address __ve, address _boost, address _rewardToken) {
        stake = _stake;
        veToken = __ve;
        boost = _boost;
        rewardToken = _rewardToken;
    }


    modifier onlyBoost() {
        require(msg.sender == boost, 'only boost');
        _;
    }

    function _safeTransferFromToken(address token, uint256 _amount) private {
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal < _amount) {
            TransferHelper.safeTransferFrom(token, boost, address(this), _amount);
        }
    }

    function _safeTokenTransfer(address token, address account, uint256 _amount) internal {
        _safeTransferFromToken(token, _amount);
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (_amount > bal) {
            _amount = bal;
        }
        _amount = derivedBalance(account, _amount);
        TransferHelper.safeTransfer(token, account, _amount);
    }

    function getReward(address account) external nonReentrant {
        require(msg.sender == account || msg.sender == boost);
        IBoost(boost).distribute(address(this));
        UserInfo memory user = userInfo[account];
        uint256 pendingAmount = user.amount.mul(accTokenPerShare).div(1e12).sub(user.rewardDebt);
        if (pendingAmount > 0) {
            _safeTokenTransfer(rewardToken, account, pendingAmount);
            emit ClaimRewards(msg.sender, rewardToken, pendingAmount);
        }
        user.rewardDebt = user.amount.mul(accTokenPerShare).div(1e12);
    }

    function derivedBalance(address account, uint _balance) public view returns (uint) {
        uint _tokenId = tokenIds[account];
        uint _derived = _balance * 30 / 100;
        uint _adjusted = 0;
        uint _supply = IBoost(boost).weights(stake);
        if (account == IVeToken(veToken).ownerOf(_tokenId) && _supply > 0) {
            uint usedWeight = IBoost(boost).usedWeights(_tokenId);
            uint useVe = IVeToken(veToken).balanceOfNFT(_tokenId);
            _adjusted = IBoost(boost).votes(_tokenId, stake).mul(1e12).mul(useVe).div(usedWeight);
            _adjusted = (totalSupply * _adjusted / _supply) * 70 / 100;
        }
        return Math.min((_derived + _adjusted), _balance);
    }


    function depositAll(uint tokenId) external {
        deposit(IERC20(stake).balanceOf(msg.sender), tokenId);
    }

    function deposit(uint amount, uint tokenId) public nonReentrant {
        require(amount > 0, "amount is 0");
        UserInfo storage user = userInfo[msg.sender];
        if (user.amount > 0) {
            uint256 pendingAmount = user.amount.mul(accTokenPerShare).div(1e12).sub(user.rewardDebt);
            if (pendingAmount > 0) {
                _safeTokenTransfer(rewardToken, msg.sender, pendingAmount);
            }
        }
        if (amount > 0) {
            TransferHelper.safeTransferFrom(stake, msg.sender, address(this), amount);
            totalSupply += amount;
            user.amount = user.amount.add(amount);
        }
        if (tokenId > 0) {
            require(IVeToken(veToken).ownerOf(tokenId) == msg.sender);
            if (tokenIds[msg.sender] == 0) {
                tokenIds[msg.sender] = tokenId;
            }
            require(tokenIds[msg.sender] == tokenId);
        } else {
            tokenId = tokenIds[msg.sender];
        }
        user.rewardDebt = user.amount.mul(accTokenPerShare).div(1e12);
        emit Deposit(msg.sender, tokenId, amount);
    }

    function withdrawAll() external {
        withdraw(userInfo[msg.sender].amount);
    }

    function withdraw(uint amount) public {
        uint tokenId = 0;
        if (amount == userInfo[msg.sender].amount) {
            tokenId = tokenIds[msg.sender];
        }
        withdrawToken(amount, tokenId);
    }

    function withdrawToken(uint _amount, uint tokenId) public nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "withdrawSwap: not good");

        uint256 pendingAmount = user.amount.mul(accTokenPerShare).div(1e12).sub(user.rewardDebt);
        if (pendingAmount > 0) {
            _safeTokenTransfer(rewardToken, msg.sender, pendingAmount);
        }
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            totalSupply = totalSupply.sub(_amount);
            TransferHelper.safeTransfer(stake, msg.sender, _amount);
        }

        user.rewardDebt = user.amount.mul(accTokenPerShare).div(1e12);

        if (tokenId > 0) {
            require(tokenId == tokenIds[msg.sender]);
            tokenIds[msg.sender] = 0;
        } else {
            tokenId = tokenIds[msg.sender];
        }
        emit Withdraw(msg.sender, tokenId, _amount);
    }

    // View function to see pending swap token on frontend.
    function pending(address _user) external view returns (uint256){
        UserInfo storage user = userInfo[_user];
        uint256 _accTokenPerShare = accTokenPerShare;
        if (user.amount > 0) {
            if (block.number > lastRewardBlock) {
                uint256 mul = block.number.sub(lastRewardBlock);
                uint256 tokenReward = tokenPerBlock.mul(mul);
                _accTokenPerShare = _accTokenPerShare.add(tokenReward.mul(1e12).div(totalSupply));
                return user.amount.mul(_accTokenPerShare).div(1e12).sub(user.rewardDebt);
            }
            if (block.number == lastRewardBlock) {
                return user.amount.mul(accTokenPerShare).div(1e12).sub(user.rewardDebt);
            }
        }
        return 0;
    }


    function notifyRewardAmount(address token, uint _rewardRate) external onlyBoost {
        require(token != stake, "no stake");
        if (block.number <= lastRewardBlock) {
            return;
        }
        tokenPerBlock = _rewardRate;
        if (totalSupply > 0) {
            uint256 mul = block.number.sub(lastRewardBlock);
            accTokenPerShare = accTokenPerShare.add(_rewardRate.mul(mul).mul(1e12).div(totalSupply));
            lastRewardBlock = block.number;
        }
        emit NotifyReward(msg.sender, token, _rewardRate);
    }

}