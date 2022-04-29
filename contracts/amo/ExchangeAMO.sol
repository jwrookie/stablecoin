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

    IStableSwap3Pool private three_pool;
    ERC20 private three_pool_erc20;
    RStablecoin private Stablecoin;
    ERC20 private collateral_token;
    IAMOMinter private amo_minter;

    address private collateral_token_address;
    address private crv_address;

    uint256 private missing_decimals;


    uint256 private PRICE_PRECISION = 1e6;

    uint256 public liq_slippage_3crv;
    uint256 public slippage_metapool;

    // Convergence window
    uint256 public convergence_window; // 0.1 cent

    // Default will use globalCollateralRatio()
    bool public custom_floor;
    uint256 public frax_floor;

    // Discount
    bool public set_discount;
    uint256 public discount_rate;

    /* ========== CONSTRUCTOR ========== */

    constructor (
        address _operatorMsg,
        address _amo_minter_address,
        address stableCoinAddress,
        address collateralToken,
        address poolAddress,
        address poolTokenAddress
    )  CheckPermission(_operatorMsg){
        Stablecoin = RStablecoin(stableCoinAddress);
        collateral_token = ERC20(collateralToken);
        missing_decimals = uint(18).sub(collateral_token.decimals());
        amo_minter = IAMOMinter(_amo_minter_address);
        three_pool = IStableSwap3Pool(poolAddress);
        three_pool_erc20 = ERC20(poolTokenAddress);
        // Other variable initializations
        liq_slippage_3crv = 800000;
        slippage_metapool = 950000;
        convergence_window = 1e15;
        custom_floor = false;
        set_discount = false;
    }

    modifier onlyByMinter() {
        require(msg.sender == address(amo_minter), "Not minter");
        _;
    }

    function showAllocations() public view returns (uint256[10] memory return_arr) {
        // ------------LP Balance------------

        // Free LP
        uint256 lp_owned = (three_pool_erc20.balanceOf(address(this)));

        // Staked in the vault
        uint256 lp_value_in_vault = usdValueInVault();
        lp_owned = lp_owned.add(lp_value_in_vault);

        // ------------3pool Withdrawable------------
        // Uses iterate() to get metapool withdrawable amounts at FRAX floor price (globalCollateralRatio)
        uint256 frax3crv_supply = three_pool_erc20.totalSupply();

        uint256 frax_withdrawable;
        uint256 _3pool_withdrawable;
        (frax_withdrawable,,) = iterate();
        //        if (frax3crv_supply > 0) {
        //            _3pool_withdrawable = _3pool_withdrawable.mul(lp_owned).div(frax3crv_supply);
        //            frax_withdrawable = frax_withdrawable.mul(lp_owned).div(frax3crv_supply);
        //        }
        //        else _3pool_withdrawable = 0;

        // ------------Frax Balance------------
        // Frax sums
        uint256 frax_in_contract = Stablecoin.balanceOf(address(this));

        // ------------Collateral Balance------------
        // Free Collateral
        uint256 usdc_in_contract = collateral_token.balanceOf(address(this));

        // Returns the dollar value withdrawable of USDC if the contract redeemed its 3CRV from the metapool; assume 1 USDC = $1
        uint256 usdc_withdrawable = _3pool_withdrawable.mul(three_pool.get_virtual_price()).div(1e18).div(10 ** missing_decimals);

        // USDC subtotal assuming FRAX drops to the CR and all reserves are arbed
        uint256 usdc_subtotal = usdc_in_contract.add(usdc_withdrawable);

        return [
        frax_in_contract, // [0] Free FRAX in the contract
        frax_withdrawable, // [1] FRAX withdrawable from the FRAX3CRV tokens
        frax_withdrawable.add(frax_in_contract), // [2] FRAX withdrawable + free FRAX in the the contract
        usdc_in_contract, // [3] Free USDC
        usdc_withdrawable, // [4] USDC withdrawable from the FRAX3CRV tokens
        usdc_subtotal, // [5] USDC subtotal assuming FRAX drops to the CR and all reserves are arbed
        usdc_subtotal.add((frax_in_contract.add(frax_withdrawable)).mul(fraxDiscountRate()).div(1e6 * (10 ** missing_decimals))), // [6] USDC Total
        lp_owned, // [7] FRAX3CRV free or in the vault
        frax3crv_supply, // [8] Total supply of FRAX3CRV tokens
        lp_value_in_vault // [10] FRAX3CRV in the vault
        ];
    }

    function dollarBalances() public view returns (uint256 frax_val_e18, uint256 collat_val_e18) {
        // Get the allocations
        uint256[10] memory allocations = showAllocations();

        frax_val_e18 = (allocations[2]).add((allocations[5]).mul((10 ** missing_decimals)));
        collat_val_e18 = (allocations[6]).mul(10 ** missing_decimals);
    }

    // Returns hypothetical reserves of metapool if the FRAX price went to the CR,
    // assuming no removal of liquidity from the metapool.
    function iterate() public view returns (uint256, uint256, uint256) {
        uint256 stablecoinBalance = Stablecoin.balanceOf(address(three_pool));

        uint256 floorPrice = uint(1e18).mul(fraxFloor()).div(1e6);
        uint256 crv3Received;
        uint256 dollarValue;
        // 3crv is usually slightly above $1 due to collecting 3pool swap fees
        for (uint i = 0; i < 256; i++) {
            crv3Received = three_pool.get_dy(0, 1, 1e18);
            dollarValue = crv3Received.mul(1e18).div(three_pool.get_virtual_price());
            if (dollarValue <= floorPrice.add(convergence_window) && dollarValue >= floorPrice.sub(convergence_window)) {

                uint256 factor = uint256(1e6);

                // Normalize back to initial balances, since this estimation method adds in extra tokens
                stablecoinBalance = stablecoinBalance.mul(factor).div(1e6);

                return (stablecoinBalance, i, factor);
            } else if (dollarValue <= floorPrice.add(convergence_window)) {
                uint256 crv3_to_swap = stablecoinBalance.div(2 ** i);
                stablecoinBalance = stablecoinBalance.sub(three_pool.get_dy(1, 0, crv3_to_swap));
            } else if (dollarValue >= floorPrice.sub(convergence_window)) {
                uint256 frax_to_swap = stablecoinBalance.div(2 ** i);
                stablecoinBalance = stablecoinBalance.add(frax_to_swap);
            }
        }
        return (0, 0, 0);
        // in 256 rounds
    }

    function fraxFloor() public view returns (uint256) {
        if (custom_floor) {
            return frax_floor;
        } else {
            return Stablecoin.globalCollateralRatio();
        }
    }

    function fraxDiscountRate() public view returns (uint256) {
        if (set_discount) {
            return discount_rate;
        } else {
            return Stablecoin.globalCollateralRatio();
        }
    }

    function usdValueInVault() public view returns (uint256) {
        //            uint256 yvCurveFrax_balance = yvCurveFRAXBalance();
        return 1e18;
    }

    // Backwards compatibility
    function mintedBalance() public view returns (int256) {
        return amo_minter.frax_mint_balances(address(this));
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function metapoolDeposit(uint256 _frax_amount, uint256 _collateral_amount) external onlyOperator returns (uint256 metapool_LP_received) {
        uint256 threeCRV_received = 0;
        if (_collateral_amount > 0) {
            // Approve the collateral to be added to 3pool
            collateral_token.approve(address(three_pool), _collateral_amount);

            // Convert collateral into 3pool
            uint256[3] memory three_pool_collaterals;
            three_pool_collaterals[1] = _collateral_amount;
            {
                uint256 min_3pool_out = (_collateral_amount * (10 ** missing_decimals)).mul(liq_slippage_3crv).div(PRICE_PRECISION);
                three_pool.add_liquidity(three_pool_collaterals, min_3pool_out);
            }

            // Approve the 3pool for the metapool
            threeCRV_received = three_pool_erc20.balanceOf(address(this));

            // WEIRD ISSUE: NEED TO DO three_pool_erc20.approve(address(three_pool), 0); first before every time
            // May be related to https://github.com/vyperlang/vyper/blob/3e1ff1eb327e9017c5758e24db4bdf66bbfae371/examples/tokens/ERC20.vy#L85
            three_pool_erc20.approve(address(three_pool), 0);
            three_pool_erc20.approve(address(three_pool), threeCRV_received);
        }

        // Approve the FRAX for the metapool
        Stablecoin.approve(address(three_pool), _frax_amount);

        {
            // Add the FRAX and the collateral to the metapool
            uint256 min_lp_out = (_frax_amount.add(threeCRV_received)).mul(slippage_metapool).div(PRICE_PRECISION);
            metapool_LP_received = three_pool.add_liquidity([_frax_amount, uint256(0), uint256(0)], min_lp_out);
        }

        return metapool_LP_received;
    }

    function metapoolWithdrawAtCurRatio(uint256 _metapool_lp_in, bool burn_the_frax, uint256 min_frax, uint256 min_3pool) external onlyOperator returns (uint256 frax_received) {
        // Approve the metapool LP tokens for the metapool contract
        three_pool_erc20.approve(address(this), _metapool_lp_in);

        // Withdraw FRAX and 3pool from the metapool at the current balance
        uint256 three_pool_received;
        {
            uint256[3] memory result_arr = three_pool.remove_liquidity(_metapool_lp_in, [min_frax, 0, 0]);
            frax_received = result_arr[0];
            three_pool_received = result_arr[1];
        }

        // Convert the 3pool into the collateral
        three_pool_erc20.approve(address(three_pool), 0);
        three_pool_erc20.approve(address(three_pool), three_pool_received);
        {
            // Add the FRAX and the collateral to the metapool
            uint256 min_collat_out = three_pool_received.mul(liq_slippage_3crv).div(PRICE_PRECISION * (10 ** missing_decimals));
            three_pool.remove_liquidity_one_coin(three_pool_received, 1, min_collat_out);
        }

        // Optionally burn the FRAX
        if (burn_the_frax) {
            burnFRAX(frax_received);
        }

    }

    function metapoolWithdrawFrax(uint256 _metapool_lp_in, bool burn_the_frax) external onlyOperator returns (uint256 frax_received) {
        // Withdraw FRAX from the metapool
        uint256 min_frax_out = _metapool_lp_in.mul(slippage_metapool).div(PRICE_PRECISION);
        frax_received = three_pool.remove_liquidity_one_coin(_metapool_lp_in, 0, min_frax_out);

        // Optionally burn the FRAX
        if (burn_the_frax) {
            burnFRAX(frax_received);
        }
    }

    function metapoolWithdraw3pool(uint256 _metapool_lp_in) public onlyOperator {
        // Withdraw 3pool from the metapool
        uint256 min_3pool_out = _metapool_lp_in.mul(slippage_metapool).div(PRICE_PRECISION);
        three_pool.remove_liquidity_one_coin(_metapool_lp_in, 1, min_3pool_out);
    }

    function three_pool_to_collateral(uint256 _3pool_in) public onlyOperator {
        // Convert the 3pool into the collateral
        // WEIRD ISSUE: NEED TO DO three_pool_erc20.approve(address(three_pool), 0); first before every time
        // May be related to https://github.com/vyperlang/vyper/blob/3e1ff1eb327e9017c5758e24db4bdf66bbfae371/examples/tokens/ERC20.vy#L85
        three_pool_erc20.approve(address(three_pool), 0);
        three_pool_erc20.approve(address(three_pool), _3pool_in);
        uint256 min_collat_out = _3pool_in.mul(liq_slippage_3crv).div(PRICE_PRECISION * (10 ** missing_decimals));
        three_pool.remove_liquidity_one_coin(_3pool_in, 1, min_collat_out);
    }

    function metapoolWithdrawAndConvert3pool(uint256 _metapool_lp_in) external onlyOperator {
        metapoolWithdraw3pool(_metapool_lp_in);
        three_pool_to_collateral(three_pool_erc20.balanceOf(address(this)));
    }



    // Give USDC profits back. Goes through the minter
    function giveCollatBack(uint256 collat_amount) external onlyOperator {
        collateral_token.approve(address(amo_minter), collat_amount);
        amo_minter.receiveCollatFromAMO(collat_amount);
    }

    // Burn unneeded or excess FRAX. Goes through the minter
    function burnFRAX(uint256 frax_amount) public onlyOperator {
        Stablecoin.approve(address(amo_minter), frax_amount);
        amo_minter.burnFraxFromAMO(frax_amount);
    }

    /* ========== RESTRICTED GOVERNANCE FUNCTIONS ========== */

    function setAMOMinter(address _amo_minter_address) external onlyOperator {
        amo_minter = IAMOMinter(_amo_minter_address);
    }

    function setConvergenceWindow(uint256 _window) external onlyOperator {
        convergence_window = _window;
    }

    // in terms of 1e6 (overriding globalCollateralRatio)
    function setCustomFloor(bool _state, uint256 _floor_price) external onlyOperator {
        custom_floor = _state;
        frax_floor = _floor_price;
    }

    // in terms of 1e6 (overriding globalCollateralRatio)
    function setDiscountRate(bool _state, uint256 _discount_rate) external onlyOperator {
        set_discount = _state;
        discount_rate = _discount_rate;
    }

    function setSlippages(uint256 _liq_slippage_3crv, uint256 _slippage_metapool) external onlyOperator {
        liq_slippage_3crv = _liq_slippage_3crv;
        slippage_metapool = _slippage_metapool;
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