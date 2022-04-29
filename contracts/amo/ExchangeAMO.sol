// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import '@openzeppelin/contracts/access/Ownable.sol';

import "../interface/curve/IStableSwap3Pool.sol";
import "../interface/curve/IMetaImplementationUSD.sol";
import '../tools/TransferHelper.sol';
import "../token/Rusd.sol";
import "../interface/IAMOMinter.sol";
import "../tools/CheckPermission.sol";

contract ExchangeAMO is CheckPermission {
    using SafeMath for uint256;

    IStableSwap3Pool private threePool;
    ERC20 private threePoolLp;
    RStablecoin private stablecoin;
    ERC20 private collateralToken;
    IAMOMinter private amoMinter;

    uint256 private missingDecimals;


    uint256 private PRICE_PRECISION = 1e6;

    uint256 public liqSlippage3crv;

    // Convergence window
    uint256 public convergenceWindow; // 0.1 cent

    bool public customFloor;
    uint256 public stableCoinFloor;

    // Discount
    bool public setDiscount;
    uint256 public discountRate;

    /* ========== CONSTRUCTOR ========== */

    constructor (
        address _operatorMsg,
        address _amo_minter_address,
        address stableCoinAddress,
        address collateralAddress,
        address poolAddress,
        address poolTokenAddress
    )  CheckPermission(_operatorMsg){
        stablecoin = RStablecoin(stableCoinAddress);
        collateralToken = ERC20(collateralAddress);
        missingDecimals = uint(18).sub(collateralToken.decimals());
        amoMinter = IAMOMinter(_amo_minter_address);
        threePool = IStableSwap3Pool(poolAddress);
        threePoolLp = ERC20(poolTokenAddress);
        // Other variable initializations
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

        uint256 frax3crv_supply = threePoolLp.totalSupply();

        uint256 frax_withdrawable;

        uint256 _3pool_withdrawable;

        frax_withdrawable = iterate();
        uint256 frax_in_contract = stablecoin.balanceOf(address(this));
        uint256 usdc_in_contract = collateralToken.balanceOf(address(this));
        uint256 usdc_withdrawable = _3pool_withdrawable.mul(threePool.get_virtual_price()).div(1e18).div(10 ** missingDecimals);
        uint256 usdc_subtotal = usdc_in_contract.add(usdc_withdrawable);

        return [
        frax_in_contract, // [0] Free FRAX in the contract
        frax_withdrawable, // [1] FRAX withdrawable from the FRAX3CRV tokens
        frax_withdrawable.add(frax_in_contract), // [2] FRAX withdrawable + free FRAX in the the contract
        usdc_in_contract, // [3] Free USDC
        usdc_withdrawable, // [4] USDC withdrawable from the FRAX3CRV tokens
        usdc_subtotal, // [5] USDC subtotal assuming FRAX drops to the CR and all reserves are arbed
        usdc_subtotal.add((frax_in_contract.add(frax_withdrawable)).mul(fraxDiscountRate()).div(1e6 * (10 ** missingDecimals))), // [6] USDC Total
        lpBalance, // [7] FRAX3CRV free or in the vault
        frax3crv_supply // [8] Total supply of FRAX3CRV tokens
        ];
    }

    function dollarBalances() public view returns (uint256 frax_val_e18, uint256 collat_val_e18) {
        // Get the allocations
//        uint256[9] memory allocations = showAllocations();

        frax_val_e18 = 0;
        //(allocations[2]).add((allocations[5]).mul((10 ** missingDecimals)));
        collat_val_e18 = 0;
        //(allocations[6]).mul(10 ** missingDecimals);
    }

    // Returns hypothetical reserves of metapool if the FRAX price went to the CR,
    function iterate() public view returns (uint256) {
        uint256 lpBalance = threePoolLp.balanceOf(address(threePool));

        uint256 floorPrice = uint(1e18).mul(fraxFloor()).div(1e6);
        uint256 crv3Received;
        uint256 dollarValue;
        // 3crv is usually slightly above $1 due to collecting 3pool swap fees

        // Calculate the current output dy given input dx
        crv3Received = threePool.get_dy(0, 1, 1e18);
        dollarValue = crv3Received.mul(1e18).div(threePool.get_virtual_price());
        if (dollarValue <= floorPrice.add(convergenceWindow) && dollarValue >= floorPrice.sub(convergenceWindow)) {

        } else if (dollarValue <= floorPrice.add(convergenceWindow)) {
            uint256 crv3_to_swap = lpBalance.div(2);
            lpBalance = lpBalance.sub(threePool.get_dy(1, 0, crv3_to_swap));
        } else if (dollarValue >= floorPrice.sub(convergenceWindow)) {
            uint256 frax_to_swap = lpBalance.div(2);
            lpBalance = lpBalance.add(frax_to_swap);
        }

        return lpBalance;
        // in 256 rounds
    }

    function fraxFloor() public view returns (uint256) {
        if (customFloor) {
            return stableCoinFloor;
        } else {
            return stablecoin.globalCollateralRatio();
        }
    }

    function fraxDiscountRate() public view returns (uint256) {
        if (setDiscount) {
            return discountRate;
        } else {
            return stablecoin.globalCollateralRatio();
        }
    }
    // Backwards compatibility
    function mintedBalance() public view returns (int256) {
        return amoMinter.frax_mint_balances(address(this));
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function metapoolDeposit(uint256 _frax_amount, uint256 _collateral_amount) external onlyOperator returns (uint256 metapool_LP_received) {
        uint256 threeCRV_received = 0;
        if (_collateral_amount > 0) {
            // Approve the collateral to be added to 3pool
            collateralToken.approve(address(threePool), _collateral_amount);

            // Convert collateral into 3pool
            uint256[3] memory three_pool_collaterals;
            three_pool_collaterals[1] = _collateral_amount;
            {
                uint256 min_3pool_out = (_collateral_amount * (10 ** missingDecimals)).mul(liqSlippage3crv).div(PRICE_PRECISION);
                threePool.add_liquidity(three_pool_collaterals, min_3pool_out);
            }

            // Approve the 3pool for the metapool
            threeCRV_received = threePoolLp.balanceOf(address(this));

            // WEIRD ISSUE: NEED TO DO three_pool_erc20.approve(address(three_pool), 0); first before every time
            // May be related to https://github.com/vyperlang/vyper/blob/3e1ff1eb327e9017c5758e24db4bdf66bbfae371/examples/tokens/ERC20.vy#L85
            threePoolLp.approve(address(threePool), 0);
            threePoolLp.approve(address(threePool), threeCRV_received);
        }

        // Approve the FRAX for the metapool
        stablecoin.approve(address(threePool), _frax_amount);

        {
            // Add the FRAX and the collateral to the metapool
            uint256 min_lp_out = (_frax_amount.add(threeCRV_received)).mul(liqSlippage3crv).div(PRICE_PRECISION);
            metapool_LP_received = threePool.add_liquidity([_frax_amount, uint256(0), uint256(0)], min_lp_out);
        }

        return metapool_LP_received;
    }

    function metapoolWithdrawAtCurRatio(uint256 _metapool_lp_in, bool burn_the_frax, uint256 min_frax, uint256 min_3pool) external onlyOperator returns (uint256 frax_received) {
        // Approve the metapool LP tokens for the metapool contract
        threePoolLp.approve(address(this), _metapool_lp_in);

        // Withdraw FRAX and 3pool from the metapool at the current balance
        uint256 three_pool_received;
        {
            uint256[3] memory result_arr = threePool.remove_liquidity(_metapool_lp_in, [min_frax, 0, 0]);
            frax_received = result_arr[0];
            three_pool_received = result_arr[1];
        }

        // Convert the 3pool into the collateral
        threePoolLp.approve(address(threePool), 0);
        threePoolLp.approve(address(threePool), three_pool_received);
        {
            // Add the FRAX and the collateral to the metapool
            uint256 min_collat_out = three_pool_received.mul(liqSlippage3crv).div(PRICE_PRECISION * (10 ** missingDecimals));
            threePool.remove_liquidity_one_coin(three_pool_received, 1, min_collat_out);
        }

        // Optionally burn the FRAX
        if (burn_the_frax) {
            burnFRAX(frax_received);
        }

    }

    function metapoolWithdrawFrax(uint256 _metapool_lp_in, bool burn_the_frax) external onlyOperator returns (uint256 frax_received) {
        // Withdraw FRAX from the metapool
        uint256 min_frax_out = _metapool_lp_in.mul(liqSlippage3crv).div(PRICE_PRECISION);
        frax_received = threePool.remove_liquidity_one_coin(_metapool_lp_in, 0, min_frax_out);

        // Optionally burn the FRAX
        if (burn_the_frax) {
            burnFRAX(frax_received);
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
        uint256 min_collat_out = _3pool_in.mul(liqSlippage3crv).div(PRICE_PRECISION * (10 ** missingDecimals));
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

    // Burn unneeded or excess FRAX. Goes through the minter
    function burnFRAX(uint256 frax_amount) public onlyOperator {
        stablecoin.approve(address(amoMinter), frax_amount);
        amoMinter.burnFraxFromAMO(frax_amount);
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
        (bool success, bytes memory result) = _to.call{value : _value}(_data);
        return (success, result);
    }
}