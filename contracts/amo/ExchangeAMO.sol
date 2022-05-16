// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../interface/curve/IStableSwap3Pool.sol";
import "../tools/TransferHelper.sol";
import "../token/Rusd.sol";
import "../interface/IAMOMinter.sol";
import "../tools/CheckPermission.sol";

contract ExchangeAMO is CheckPermission {
    using SafeMath for uint256;

    uint256 public constant PRICE_PRECISION = 1e6;

    IStableSwap3Pool public threePool;
    ERC20 public threePoolLp;
    RStablecoin public stablecoin;
    ERC20 public collateralToken;
    IAMOMinter public amoMinter;

    uint256 public missingDecimals;



    uint256 public liqSlippage3crv;

    // Convergence window
    uint256 public convergenceWindow; // 0.1 cent

    bool public customFloor;
    uint256 public stableCoinFloor;

    // Discount
    bool public setDiscount;
    uint256 public discountRate;

    constructor(
        address _operatorMsg,
        address _amoMinterAddress,
        address stableCoinAddress,
        address collateralAddress,
        address poolAddress,
        address poolTokenAddress
    ) CheckPermission(_operatorMsg) {
        stablecoin = RStablecoin(stableCoinAddress);
        collateralToken = ERC20(collateralAddress);
        missingDecimals = uint256(18).sub(collateralToken.decimals());
        amoMinter = IAMOMinter(_amoMinterAddress);
        threePool = IStableSwap3Pool(poolAddress);
        threePoolLp = ERC20(poolTokenAddress);
        liqSlippage3crv = 800000;
        convergenceWindow = 1e15;
        customFloor = false;
        setDiscount = false;
    }

    modifier onlyByMinter() {
        require(msg.sender == address(amoMinter), "Not minter");
        _;
    }

    function showAllocations() public view returns (uint256[9] memory arr) {
        uint256 lpBalance = threePoolLp.balanceOf(address(this));
        uint256 stable3crvSupply = threePoolLp.totalSupply();
        uint256 stableWithdrawable;
        uint256 pool3Withdrawable;
        stableWithdrawable = iterate();
        uint256 stableInContract = stablecoin.balanceOf(address(this));
        uint256 usdcInContract = collateralToken.balanceOf(address(this));
        uint256 usdcWithdrawable = pool3Withdrawable.mul(threePool.get_virtual_price()).div(1e18).div(
            10**missingDecimals
        );
        uint256 usdcSubtotal = usdcInContract.add(usdcWithdrawable);

        return [
        stableInContract, // [0] Free stable in the contract
        stableWithdrawable, // [1] stable withdrawable from the FRAX3CRV tokens
            stableWithdrawable.add(stableInContract), // [2] stable withdrawable + free FRAX in the the contract
        usdcInContract, // [3] Free USDC
        usdcWithdrawable, // [4] USDC withdrawable from the FRAX3CRV tokens
        usdcSubtotal, // [5] USDC subtotal assuming FRAX drops to the CR and all reserves are arbed
            usdcSubtotal.add(
                (stableInContract.add(stableWithdrawable)).mul(stableDiscountRate()).div(1e6 * (10**missingDecimals))
            ), // [6] USDC Total
            lpBalance, // [7] FRAX3CRV free or in the vault
        stable3crvSupply // [8] Total supply of stable tokens
        ];
    }

    function dollarBalances() public view returns (uint256 stableValE18, uint256 collatValE18) {
        // Get the allocations
        uint256[9] memory allocations = showAllocations();

        stableValE18 = (allocations[2]).add((allocations[5]).mul((10**missingDecimals)));
        collatValE18 = (allocations[6]).mul(10**missingDecimals);
    }

    // Returns hypothetical reserves of metapool if the stable price went to the CR,
    function iterate() public view returns (uint256) {
        uint256 lpBalance = threePoolLp.balanceOf(address(threePool));

        uint256 floorPrice = uint256(1e18).mul(stableFloor()).div(1e6);
        uint256 crv3Received;
        uint256 dollarValue;
        // 3crv is usually slightly above $1 due to collecting 3pool swap fees

        // Calculate the current output dy given input dx
        crv3Received = threePool.get_dy(0, 1, 1e18);
        dollarValue = crv3Received.mul(1e18).div(threePool.get_virtual_price());
        if (
            dollarValue <= floorPrice.add(convergenceWindow) && dollarValue >= floorPrice.sub(convergenceWindow)
        ) {} else if (dollarValue <= floorPrice.add(convergenceWindow)) {
            uint256 crv3ToSwap = lpBalance.div(2);
            lpBalance = lpBalance.sub(threePool.get_dy(1, 0, crv3ToSwap));
        } else if (dollarValue >= floorPrice.sub(convergenceWindow)) {
            uint256 stableToSwap = lpBalance.div(2);
            lpBalance = lpBalance.add(stableToSwap);
        }
        return lpBalance;
    }

    function stableFloor() public view returns (uint256) {
        if (customFloor) {
            return stableCoinFloor;
        } else {
            return stablecoin.globalCollateralRatio();
        }
    }

    function stableDiscountRate() public view returns (uint256) {
        if (setDiscount) {
            return discountRate;
        } else {
            return stablecoin.globalCollateralRatio();
        }
    }

    // Backwards compatibility
    function mintedBalance() public view returns (int256) {
        return amoMinter.stableMintBalances(address(this));
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function metapoolDeposit(uint256 _stableAmount, uint256 _collateralAmount)
        external
        onlyOperator
        returns (uint256 lpReceived)
    {
        uint256 threeCRVReceived = 0;
        if (_collateralAmount > 0) {
            // Approve the collateral to be added to 3pool
            collateralToken.approve(address(threePool), _collateralAmount);

            // Convert collateral into 3pool
            uint256[3] memory threePoolCollaterals;
            threePoolCollaterals[1] = _collateralAmount;
            {
                uint256 min_3pool_out = (_collateralAmount * (10**missingDecimals)).mul(liqSlippage3crv).div(
                    PRICE_PRECISION
                );
                threePool.add_liquidity(threePoolCollaterals, min_3pool_out);
            }

            // Approve the 3pool for the metapool
            threeCRVReceived = threePoolLp.balanceOf(address(this));

            // WEIRD ISSUE: NEED TO DO three_pool_erc20.approve(address(three_pool), 0); first before every time
            // May be related to https://github.com/vyperlang/vyper/blob/3e1ff1eb327e9017c5758e24db4bdf66bbfae371/examples/tokens/ERC20.vy#L85
            threePoolLp.approve(address(threePool), 0);
            threePoolLp.approve(address(threePool), threeCRVReceived);
        }

        // Approve the FRAX for the metapool
        stablecoin.approve(address(threePool), _stableAmount);

        {
            // Add the FRAX and the collateral to the metapool
            uint256 minLpOut = (_stableAmount.add(threeCRVReceived)).mul(liqSlippage3crv).div(PRICE_PRECISION);
            lpReceived = threePool.add_liquidity([_stableAmount, uint256(0), uint256(0)], minLpOut);
        }

        return lpReceived;
    }

    function metapoolWithdrawAtCurRatio(
        uint256 metapoolLpIn,
        bool burnTheStable,
        uint256 minStable,
        uint256 min3pool
    ) external onlyOperator returns (uint256 stableReceived) {
        // Approve the metapool LP tokens for the metapool contract
        threePoolLp.approve(address(this), metapoolLpIn);

        // Withdraw FRAX and 3pool from the metapool at the current balance
        uint256 threePoolReceived;
        {
            uint256[3] memory result_arr = threePool.remove_liquidity(metapoolLpIn, [minStable, 0, 0]);
            stableReceived = result_arr[0];
            threePoolReceived = result_arr[1];
        }

        // Convert the 3pool into the collateral
        threePoolLp.approve(address(threePool), 0);
        threePoolLp.approve(address(threePool), threePoolReceived);
        {
            // Add the stable and the collateral to the metapool
            uint256 minCollatOut = threePoolReceived.mul(liqSlippage3crv).div(
                PRICE_PRECISION * (10**missingDecimals)
            );
            threePool.remove_liquidity_one_coin(threePoolReceived, 1, minCollatOut);
        }

        // Optionally burn the FRAX
        if (burnTheStable) {
            burnStable(stableReceived);
        }
    }

    function metapoolWithdrawFrax(uint256 _metapool_lp_in, bool burn_the_frax)
        external
        onlyOperator
        returns (uint256 frax_received)
    {
        // Withdraw FRAX from the metapool
        uint256 min_frax_out = _metapool_lp_in.mul(liqSlippage3crv).div(PRICE_PRECISION);
        frax_received = threePool.remove_liquidity_one_coin(_metapool_lp_in, 0, min_frax_out);

        // Optionally burn the FRAX
        if (burn_the_frax) {
            burnStable(frax_received);
        }
    }

    function metapoolWithdraw3pool(uint256 _metapool_lp_in) public onlyOperator {
        // Withdraw 3pool from the metapool
        uint256 min_3pool_out = _metapool_lp_in.mul(liqSlippage3crv).div(PRICE_PRECISION);
        threePool.remove_liquidity_one_coin(_metapool_lp_in, 1, min_3pool_out);
    }

    function three_pool_to_collateral(uint256 _3pool_in) public onlyOperator {
        // Convert the 3pool into the collateral
        // WEIRD ISSUE: NEED TO DO three_pool_erc20.approve(address(three_pool), 0); first before every time
        // May be related to https://github.com/vyperlang/vyper/blob/3e1ff1eb327e9017c5758e24db4bdf66bbfae371/examples/tokens/ERC20.vy#L85
        threePoolLp.approve(address(threePool), 0);
        threePoolLp.approve(address(threePool), _3pool_in);
        uint256 min_collat_out = _3pool_in.mul(liqSlippage3crv).div(PRICE_PRECISION * (10**missingDecimals));
        threePool.remove_liquidity_one_coin(_3pool_in, 1, min_collat_out);
    }

    function metapoolWithdrawAndConvert3pool(uint256 _metapool_lp_in) external onlyOperator {
        metapoolWithdraw3pool(_metapool_lp_in);
        three_pool_to_collateral(threePoolLp.balanceOf(address(this)));
    }

    // Give USDC profits back. Goes through the minter
    function giveCollatBack(uint256 collat_amount) external onlyOperator {
        collateralToken.approve(address(amoMinter), collat_amount);
        amoMinter.receiveCollatFromAMO(collat_amount);
    }

    function burnStock(uint256 _amount) public onlyOperator {
        stablecoin.approve(address(amoMinter), _amount);
        amoMinter.burnStockFromAMO(_amount);
    }

    // Burn unneeded or excess stable. Goes through the minter
    function burnStable(uint256 frax_amount) public onlyOperator {
        stablecoin.approve(address(amoMinter), frax_amount);
        amoMinter.burnStableFromAMO(frax_amount);
    }

    /* ========== RESTRICTED GOVERNANCE FUNCTIONS ========== */

    function setAMOMinter(address _amo_minter_address) external onlyOperator {
        amoMinter = IAMOMinter(_amo_minter_address);
    }

    function setConvergenceWindow(uint256 _window) external onlyOperator {
        convergenceWindow = _window;
    }

    // in terms of 1e6 (overriding globalCollateralRatio)
    function setCustomFloor(bool _state, uint256 _floor_price) external onlyOperator {
        customFloor = _state;
        stableCoinFloor = _floor_price;
    }

    // in terms of 1e6 (overriding globalCollateralRatio)
    function setDiscountRate(bool _state, uint256 _discount_rate) external onlyOperator {
        setDiscount = _state;
        discountRate = _discount_rate;
    }

    function setSlippages(uint256 _liq_slippage_3crv, uint256 _slippage_metapool) external onlyOperator {
        liqSlippage3crv = _liq_slippage_3crv;
    }

    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOperator {
        // Can only be triggered by owner or governance, not custodian
        // Tokens are sent to the custodian, as a sort of safeguard
        TransferHelper.safeTransfer(address(tokenAddress), msg.sender, tokenAmount);
    }

    // Generic proxy
    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external onlyOperator returns (bool, bytes memory) {
        (bool success, bytes memory result) = _to.call{value: _value}(_data);
        return (success, result);
    }
}
