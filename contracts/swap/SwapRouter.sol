// SPDX-License-Identifier: MIT

pragma solidity =0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../tools/CheckPermission.sol";
import "../tools/TransferHelper.sol";
import "../interface/IStablePool.sol";
import "../interface/curve/IZapDepositor4pool.sol";
import "../interface/ICryptoPool.sol";
import "../interface/ISwapMining.sol";

contract SwapRouter is CheckPermission {
    event ChangeSwapMining(address indexed oldSwapMining, address indexed newSwapMining);

    address public wETH;

    address public swapMining;

    constructor(address _operatorMsg, address _weth) CheckPermission(_operatorMsg){
        wETH = _weth;
    }

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "Router: EXPIRED");
        _;
    }

    // address(0) means no swap mining
    function setSwapMining(address addr) public onlyOperator {
        address oldSwapMining = swapMining;
        swapMining = addr;
        emit ChangeSwapMining(oldSwapMining, swapMining);
    }

    function _callStableSwapMining(
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

    function _callCryptoSwapMining(
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

    function _callCryptoTokenSwapMining(
        address account,
        address pair,
        uint256 i,
        uint256 amount
    ) private {
        if (swapMining != address(0)) {
            uint256 quantity;
            uint256[5] memory amounts;
            amounts[i] = amount;
            quantity = IZapDepositor4pool(pair).calc_token_amount(amounts, false);
            ISwapMining(swapMining).swap(account, pair, quantity);
        }
    }

    function swapStable(
        address pool,
        uint256 from,
        uint256 to,
        uint256 _fromAmount,
        uint256 _minToAmount,
        address receiver,
        uint256 deadline
    ) external ensure(deadline) {
        int128 fromInt = int128(uint128(from));
        int128 toInt = int128(uint128(to));
        address fromToken = IStablePool(pool).coins(from);
        //        address toToken = IStablePool(pool).coins(to);
        if (IERC20(fromToken).allowance(address(this), pool) < _fromAmount) {
            TransferHelper.safeApprove(fromToken, pool, type(uint256).max);
        }
        TransferHelper.safeTransferFrom(fromToken, msg.sender, address(this), _fromAmount);
        IStablePool(pool).exchange(fromInt, toInt, _fromAmount, _minToAmount, receiver);
        _callStableSwapMining(receiver, pool, from, _fromAmount);
    }

    function swapMeta(
        address pool,
        uint256 from,
        uint256 to,
        uint256 _fromAmount,
        uint256 _minAmount,
        address receiver,
        uint256 deadline
    ) external ensure(deadline) {
        int128 fromInt = int128(uint128(from));
        int128 toInt = int128(uint128(to));
        address fromToken;
        uint256 callStable = 0;
        if (from == 0) {
            fromToken = IStablePool(pool).coins(from);
        } else {
            fromToken = IStablePool(pool).base_coins(from - 1);
            callStable = 1;
        }

        if (IERC20(fromToken).allowance(address(this), pool) < _fromAmount) {
            TransferHelper.safeApprove(fromToken, pool, type(uint256).max);
        }

        TransferHelper.safeTransferFrom(fromToken, msg.sender, address(this), _fromAmount);
        IStablePool(pool).exchange_underlying(fromInt, toInt, _fromAmount, _minAmount, receiver);
        _callStableSwapMining(receiver, pool, callStable, _fromAmount);
    }

    function swapToken(
        address pool,
        uint256 from,
        uint256 to,
        uint256 _fromAmount,
        uint256 _minAmount,
        address receiver,
        uint256 deadline
    ) external ensure(deadline) {
        address fromToken = IStablePool(pool).coins(from);
//        address toToken = IStablePool(pool).coins(to);
        if (IERC20(fromToken).allowance(address(this), pool) < _fromAmount) {
            TransferHelper.safeApprove(fromToken, pool, type(uint256).max);
        }
        TransferHelper.safeTransferFrom(fromToken, msg.sender, address(this), _fromAmount);
        ICryptoPool(pool).exchange(from, to, _fromAmount, _minAmount, false, receiver);
        _callCryptoSwapMining(receiver, pool, from, _fromAmount);
    }

    function swapCryptoToken(
        address pool,
        uint256 from,
        uint256 to,
        uint256 _fromAmount,
        uint256 _minAmount,
        address receiver,
        uint256 deadline
    ) external ensure(deadline) {
        address fromToken = IZapDepositor4pool(pool).underlying_coins(from);
        if (IERC20(fromToken).allowance(address(this), pool) < _fromAmount) {
            TransferHelper.safeApprove(fromToken, pool, type(uint256).max);
        }
        TransferHelper.safeTransferFrom(fromToken, msg.sender, address(this), _fromAmount);
        IZapDepositor4pool(pool).exchange_underlying(from, to, _fromAmount, _minAmount, receiver);
        _callCryptoTokenSwapMining(receiver, pool, from, _fromAmount);
    }

    function swapEthForToken(
        address pool,
        uint256 from,
        uint256 to,
        uint256 _fromAmount,
        uint256 _minAmount,
        address receiver,
        uint256 deadline
    ) external payable ensure(deadline) {
        uint256 bal = msg.value;
        address fromToken = IStablePool(pool).coins(from);
        if (fromToken != wETH) {
            if (IERC20(fromToken).allowance(address(this), pool) < _fromAmount) {
                TransferHelper.safeApprove(fromToken, pool, type(uint256).max);
            }

            TransferHelper.safeTransferFrom(fromToken, msg.sender, address(this), _fromAmount);
        }

        ICryptoPool(pool).exchange{value : bal}(from, to, _fromAmount, _minAmount, true, receiver);
        _callCryptoSwapMining(receiver, pool, from, _fromAmount);
    }

    function recoverERC20(address _tokenAddress, uint256 _tokenAmount) external onlyOperator {
        TransferHelper.safeTransfer(_tokenAddress, owner(), _tokenAmount);
        emit Recovered(_tokenAddress, _tokenAmount);
    }

    event Recovered(address _token, uint256 _amount);
}
