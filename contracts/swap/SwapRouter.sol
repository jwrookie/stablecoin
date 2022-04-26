pragma solidity =0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../tools/TransferHelper.sol";
import "../interface/IStablePool.sol";
import "../interface/ICryptoPool.sol";
import "../interface/ISwapMining.sol";

contract SwapRouter is Ownable {
    event ChangeSwapMining(
        address indexed oldSwapMining,
        address indexed newSwapMining
    );

    address public WETH;

    address public swapMining;

    constructor(address _weth) {
        WETH = _weth;
    }

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "Router: EXPIRED");
        _;
    }

    // address(0) means no swap mining
    function setSwapMining(address addr) public onlyOwner {
        address oldSwapMining = swapMining;
        swapMining = addr;
        emit ChangeSwapMining(oldSwapMining, swapMining);
    }

    function callStableSwapMining(
        address account,
        address pair,
        uint256 i,
        uint256 amount
    ) private {
        if (swapMining != address(0)) {
            int128 n = IStablePool(pair).n_coins();
            uint256 quantity;
            if (n == 2) {
                uint256[2] memory amounts;
                amounts[i] = amount;
                quantity = IStablePool(pair).calc_token_amount(amounts, false);
            } else if (n == 3) {
                uint256[3] memory amounts;
                amounts[i] = amount;
                quantity = IStablePool(pair).calc_token_amount(amounts, false);
            } else {
                uint256[4] memory amounts;
                amounts[i] = amount;
                quantity = IStablePool(pair).calc_token_amount(amounts, false);
            }
            ISwapMining(swapMining).swap(account, pair, quantity);
        }
    }

    function callCryptoSwapMining(
        address account,
        address pair,
        uint256 i,
        uint256 amount
    ) private {
        if (swapMining != address(0)) {
            uint256 n = ICryptoPool(pair).n_coins();
            uint256 quantity;
            if (n == 2) {
                uint256[2] memory amounts;
                amounts[i] = amount;
                quantity = ICryptoPool(pair).calc_token_amount(amounts);
            } else if (n == 3) {
                uint256[3] memory amounts;
                amounts[i] = amount;
                quantity = ICryptoPool(pair).calc_token_amount(amounts);
            } else {
                uint256[4] memory amounts;
                amounts[i] = amount;
                quantity = ICryptoPool(pair).calc_token_amount(amounts);
            }
            ISwapMining(swapMining).swap(account, pair, quantity);
        }
    }

    function swapStable(
        address pool,
        uint256 from,
        uint256 to,
        uint256 _from_amount,
        uint256 _min_to_amount,
        address receiver,
        uint256 deadline
    ) external ensure(deadline) {
        int128 fromInt = int128(uint128(from));
        int128 toInt = int128(uint128(to));
        address fromToken = IStablePool(pool).coins(from);
        address toToken = IStablePool(pool).coins(to);
        if (IERC20(fromToken).allowance(address(this), pool) < _from_amount) {
            TransferHelper.safeApprove(fromToken, pool, type(uint256).max);
        }
        TransferHelper.safeTransferFrom(
            fromToken,
            msg.sender,
            address(this),
            _from_amount
        );
        IStablePool(pool).exchange(
            fromInt,
            toInt,
            _from_amount,
            _min_to_amount,
            receiver
        );
        callStableSwapMining(receiver, pool, from, _from_amount);
    }

    function swapMeta(
        address pool,
        uint256 from,
        uint256 to,
        uint256 _from_amount,
        uint256 _min_to_amount,
        address receiver,
        uint256 deadline
    ) external ensure(deadline) {
        int128 fromInt = int128(uint128(from));
        int128 toInt = int128(uint128(to));
        address fromToken = IStablePool(pool).coins(from);
        if (IERC20(fromToken).allowance(address(this), pool) < _from_amount) {
            TransferHelper.safeApprove(fromToken, pool, type(uint256).max);
        }
        TransferHelper.safeTransferFrom(
            fromToken,
            msg.sender,
            address(this),
            _from_amount
        );
        IStablePool(pool).exchange_underlying(
            fromInt,
            toInt,
            _from_amount,
            _min_to_amount,
            receiver
        );
        callStableSwapMining(receiver, pool, from, _from_amount);
    }

    function swapToken(
        address pool,
        uint256 from,
        uint256 to,
        uint256 _from_amount,
        uint256 _min_to_amount,
        address receiver,
        uint256 deadline
    ) external ensure(deadline) {
        address fromToken = IStablePool(pool).coins(from);
        address toToken = IStablePool(pool).coins(to);
        if (IERC20(fromToken).allowance(address(this), pool) < _from_amount) {
            TransferHelper.safeApprove(fromToken, pool, type(uint256).max);
        }
        TransferHelper.safeTransferFrom(
            fromToken,
            msg.sender,
            address(this),
            _from_amount
        );
        ICryptoPool(pool).exchange(
            from,
            to,
            _from_amount,
            _min_to_amount,
            false,
            receiver
        );
        callCryptoSwapMining(receiver, pool, from, _from_amount);
    }

    function swapEthForToken(
        address pool,
        uint256 from,
        uint256 to,
        uint256 _from_amount,
        uint256 _min_to_amount,
        address receiver,
        uint256 deadline
    ) external payable ensure(deadline) {
        uint256 bal = msg.value;
        address fromToken = IStablePool(pool).coins(from);
        if (fromToken != WETH) {
            if (
                IERC20(fromToken).allowance(address(this), pool) < _from_amount
            ) {
                TransferHelper.safeApprove(fromToken, pool, type(uint256).max);
            }

            TransferHelper.safeTransferFrom(
                fromToken,
                msg.sender,
                address(this),
                _from_amount
            );
        }

        ICryptoPool(pool).exchange{value : bal}(
            from,
            to,
            _from_amount,
            _min_to_amount,
            true,
            receiver
        );
        callCryptoSwapMining(receiver, pool, from, _from_amount);
    }

    function recoverERC20(address _tokenAddress, uint256 _tokenAmount)
    external
    onlyOwner
    {
        TransferHelper.safeTransfer(_tokenAddress, owner(), _tokenAmount);
        emit Recovered(_tokenAddress, _tokenAmount);
    }

    event Recovered(address _token, uint256 _amount);
}
