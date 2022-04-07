pragma solidity =0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import '../Uniswap/TransferHelper.sol';
import "../interface/IStablePool.sol";
import "../interface/ICryptoPool.sol";
import "../interface/ISwapMining.sol";
import "../tools/Operatable.sol";

contract SwapRouter is Operatable {

    event ChangeSwapMining(address indexed oldSwapMining, address indexed newSwapMining);

    address public swapMining;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'Router: EXPIRED');
        _;
    }

    // address(0) means no swap mining
    function setSwapMining(address addr) public onlyOperator {
        address oldSwapMining = swapMining;
        swapMining = addr;
        emit ChangeSwapMining(oldSwapMining, swapMining);
    }

    function callSwapMining(address account, address pair, uint256 i, uint256 amount) private {
        if (swapMining != address(0)) {
            int128 n = ICryptoPool(pair).N_COINS();
            uint256 quantity;
            if (n == 2) {
                uint256[2] memory amounts;
                amounts[i] = amount;
                quantity = ICryptoPool(pair).calc_token_amount(amounts, false);
            } else if (n == 3) {
                uint256[3] memory amounts;
                amounts[i] = amount;
                quantity = ICryptoPool(pair).calc_token_amount(amounts, false);
            } else {
                uint256[4] memory amounts;
                amounts[i] = amount;
                quantity = ICryptoPool(pair).calc_token_amount(amounts, false);
            }
            ISwapMining(swapMining).swap(
                account,
                pair,
                quantity
            );
        }
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
        callSwapMining(receiver, pool, from, _from_amount);
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
        callSwapMining(receiver, pool, from, _from_amount);
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
        callSwapMining(receiver, pool, from, _from_amount);
    }

    function recoverERC20(address _tokenAddress, uint256 _tokenAmount) external onlyOwner {
        TransferHelper.safeTransfer(_tokenAddress, owner(), _tokenAmount);
        emit Recovered(_tokenAddress, _tokenAmount);
    }

    event Recovered(address _token, uint256 _amount);
}
