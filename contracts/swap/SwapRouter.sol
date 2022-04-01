pragma solidity =0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import '../Uniswap/TransferHelper.sol';
import "../interface/IStablePool.sol";
import "../interface/ICryptoPool.sol";
import "../tools/Operatable.sol";

contract SwapRouter is Operatable {

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'Router: EXPIRED');
        _;
    }

    function swapStable(
        address pool,
        uint256 from,
        uint256 to,
        uint256 _from_amount,
        uint256 _min_to_amount,
        address receiver,
        uint deadline
    ) external ensure(deadline) {
        int128 fromInt = int128(uint128(from));
        int128 toInt = int128(uint128(to));
        address fromToken = IStablePool(pool).coins(fromInt);
        address toToken = IStablePool(pool).coins(toInt);
        if (IERC20(fromToken).allowance(address(this), pool) < _from_amount) {

            TransferHelper.safeApprove(fromToken, pool, type(uint256).max);
        }
        IStablePool(pool).exchange(fromInt, toInt, _from_amount, _min_to_amount, receiver);
    }

    function swapToken(
        address pool,
        uint256 from,
        uint256 to,
        uint256 _from_amount,
        uint256 _min_to_amount,
        address receiver,
        uint deadline
    ) external ensure(deadline) {
        address fromToken = IStablePool(pool).coins(int128(uint128(from)));
        address toToken = IStablePool(pool).coins(int128(uint128(to)));
        if (IERC20(fromToken).allowance(address(this), pool) < _from_amount) {
            TransferHelper.safeApprove(fromToken, pool, type(uint256).max);
        }
        ICryptoPool(pool).exchange(from, to, _from_amount, _min_to_amount, false, receiver);
    }

    function swapEthForToken(
        address pool,
        uint256 from,
        uint256 to,
        uint256 _from_amount,
        uint256 _min_to_amount,
        address receiver,
        uint deadline
    ) external payable ensure(deadline) {
        uint bal = msg.value;
        ICryptoPool(pool).exchange{value : bal}(from, to, _from_amount, _min_to_amount, true, receiver);
    }

    function recoverERC20(address _tokenAddress, uint256 _tokenAmount) external onlyOwner {
        TransferHelper.safeTransfer(_tokenAddress, owner(), _tokenAmount);
        emit Recovered(_tokenAddress, _tokenAmount);
    }

    event Recovered(address _token, uint256 _amount);
}
